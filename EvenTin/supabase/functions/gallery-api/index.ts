import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const bucketName = "eventin-gallery";
const maxImageBytes = 512000;
const maxThumbnailBytes = 50 * 1024;
const allowedTypes: Record<string, string> = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png"
};

type GalleryPayload = {
    action?: string;
    event_key?: string;
    token?: string;
    access_key?: string;
    image_id?: string;
    image_base64?: string;
    content_type?: string;
    thumbnail_base64?: string;
    thumbnail_content_type?: string;
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

function cleanText(value: unknown) {
    return String(value || "").trim();
}

function decodeBase64(value: string) {
    const raw = atob(value);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return jsonResponse({ error: "Function is not configured" }, 500);
    }

    let payload: GalleryPayload;
    try {
        payload = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const action = cleanText(payload.action);
    const authorization = request.headers.get("Authorization") || "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false }
    });

    async function getProfile() {
        if (!authorization.startsWith("Bearer ")) {
            return null;
        }

        const { data: authData } = await userClient.auth.getUser();
        if (!authData.user) {
            return null;
        }

        const { data: profile } = await adminClient
            .from("eventin_profiles")
            .select("id,role,event_code")
            .eq("id", authData.user.id)
            .maybeSingle();

        return profile || null;
    }

    async function getEventByKey(eventKey: string) {
        if (!eventKey) {
            return null;
        }

        const column = /^[0-9]{6}$/.test(eventKey) ? "event_code" : "public_slug";
        const { data } = await adminClient
            .from("eventin_events")
            .select("id,title,event_code,public_slug,is_active")
            .eq(column, eventKey)
            .eq("is_active", true)
            .maybeSingle();
        return data || null;
    }

    async function getEventById(eventId: string) {
        const { data } = await adminClient
            .from("eventin_events")
            .select("id,title,event_code,public_slug,is_active")
            .eq("id", eventId)
            .maybeSingle();
        return data || null;
    }

    async function verifyCollaborativeAccess() {
        const token = cleanText(payload.token);
        const accessKey = cleanText(payload.access_key);
        if (!token || !accessKey) {
            return null;
        }

        const { data, error } = await adminClient.rpc("eventin_verify_collaborative_gallery_access", {
            p_token: token,
            p_access_key: accessKey
        });
        if (error) {
            console.error("Collaborative gallery verification failed", error);
            throw new Error("Could not verify gallery access");
        }
        return data ? getEventById(data) : null;
    }

    async function listImages(eventId: string, galleryType: "public" | "collaborative") {
        const { data: images, error } = await adminClient
            .from("eventin_gallery_images")
            .select("*")
            .eq("event_id", eventId)
            .eq("gallery_type", galleryType)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        if (!images?.length) {
            return [];
        }

        const { data: signedImages, error: signError } = await adminClient.storage
            .from(bucketName)
            .createSignedUrls(images.map((image) => image.storage_path), 3600);

        if (signError) {
            throw signError;
        }

        const thumbnailPaths = images
            .map((image) => image.thumbnail_storage_path)
            .filter(Boolean);
        const { data: signedThumbnails, error: thumbnailSignError } = thumbnailPaths.length
            ? await adminClient.storage.from(bucketName).createSignedUrls(thumbnailPaths, 3600)
            : { data: [], error: null };

        if (thumbnailSignError) {
            throw thumbnailSignError;
        }

        const thumbnailUrls = new Map(
            thumbnailPaths.map((path, index) => [path, signedThumbnails?.[index]?.signedUrl || ""])
        );

        return images.map((image, index) => ({
            id: image.id,
            url: signedImages?.[index]?.signedUrl || "",
            thumbnail_url: thumbnailUrls.get(image.thumbnail_storage_path) || signedImages?.[index]?.signedUrl || "",
            created_at: image.created_at
        }));
    }

    async function uploadImage(eventId: string, galleryType: "public" | "collaborative", uploadedBy: string | null) {
        const contentType = cleanText(payload.content_type);
        const extension = allowedTypes[contentType];
        const imageBase64 = cleanText(payload.image_base64);
        const thumbnailContentType = cleanText(payload.thumbnail_content_type);
        const thumbnailExtension = allowedTypes[thumbnailContentType];
        const thumbnailBase64 = cleanText(payload.thumbnail_base64);
        if (!extension || !imageBase64 || !thumbnailExtension || !thumbnailBase64) {
            return jsonResponse({ error: "Invalid image" }, 400);
        }

        let bytes: Uint8Array;
        let thumbnailBytes: Uint8Array;
        try {
            bytes = decodeBase64(imageBase64);
            thumbnailBytes = decodeBase64(thumbnailBase64);
        } catch (_error) {
            return jsonResponse({ error: "Invalid image data" }, 400);
        }

        if (!bytes.length || bytes.length > maxImageBytes) {
            return jsonResponse({ error: "Image exceeds 500 KB" }, 413);
        }
        if (!thumbnailBytes.length || thumbnailBytes.length > maxThumbnailBytes) {
            return jsonResponse({ error: "Thumbnail exceeds 50 KB" }, 413);
        }

        const imageId = crypto.randomUUID();
        const storagePath = `${eventId}/${galleryType}/${imageId}.${extension}`;
        const thumbnailStoragePath = `${eventId}/${galleryType}/thumbnails/${imageId}.${thumbnailExtension}`;
        const { error: uploadError } = await adminClient.storage
            .from(bucketName)
            .upload(storagePath, bytes, { contentType, upsert: false });

        if (uploadError) {
            console.error("Gallery upload failed", uploadError);
            return jsonResponse({ error: "Could not upload image" }, 502);
        }

        const { error: thumbnailUploadError } = await adminClient.storage
            .from(bucketName)
            .upload(thumbnailStoragePath, thumbnailBytes, { contentType: thumbnailContentType, upsert: false });

        if (thumbnailUploadError) {
            await adminClient.storage.from(bucketName).remove([storagePath]);
            console.error("Gallery thumbnail upload failed", thumbnailUploadError);
            return jsonResponse({ error: "Could not upload thumbnail" }, 502);
        }

        const { error: insertError } = await adminClient
            .from("eventin_gallery_images")
            .insert({
                id: imageId,
                event_id: eventId,
                gallery_type: galleryType,
                storage_path: storagePath,
                thumbnail_storage_path: thumbnailStoragePath,
                uploaded_by: uploadedBy
            });

        if (insertError) {
            await adminClient.storage.from(bucketName).remove([storagePath, thumbnailStoragePath]);
            console.error("Gallery metadata insert failed", insertError);
            return jsonResponse({ error: "Could not save image" }, 502);
        }

        return jsonResponse({ ok: true, id: imageId });
    }

    if (action === "list_public") {
        const eventData = await getEventByKey(cleanText(payload.event_key));
        if (!eventData) {
            return jsonResponse({ error: "Event not found" }, 404);
        }

        const profile = await getProfile();
        const canManage = Boolean(profile && (profile.role === "admin" || profile.event_code === eventData.event_code));
        return jsonResponse({
            event: { title: eventData.title, public_slug: eventData.public_slug, event_code: eventData.event_code },
            can_manage: canManage,
            images: await listImages(eventData.id, "public")
        });
    }

    if (action === "upload_public") {
        const eventData = await getEventByKey(cleanText(payload.event_key));
        const profile = await getProfile();
        if (!eventData || !profile || (profile.role !== "admin" && profile.event_code !== eventData.event_code)) {
            return jsonResponse({ error: "Access denied" }, 403);
        }
        return uploadImage(eventData.id, "public", profile.id);
    }

    if (action === "list_collaborative") {
        const eventData = await verifyCollaborativeAccess();
        if (!eventData) {
            return jsonResponse({ error: "Invalid gallery access" }, 403);
        }
        const profile = await getProfile();
        const canDelete = Boolean(profile && (
            profile.role === "admin"
            || profile.event_code === eventData.event_code
        ));
        return jsonResponse({
            event: { title: eventData.title, public_slug: eventData.public_slug, event_code: eventData.event_code },
            can_delete: canDelete,
            images: await listImages(eventData.id, "collaborative")
        });
    }

    if (action === "upload_collaborative") {
        const eventData = await verifyCollaborativeAccess();
        if (!eventData) {
            return jsonResponse({ error: "Invalid gallery access" }, 403);
        }
        const profile = await getProfile();
        return uploadImage(eventData.id, "collaborative", profile?.id || null);
    }

    if (action === "delete_public" || action === "delete_collaborative") {
        const imageId = cleanText(payload.image_id);
        const galleryType = action === "delete_public" ? "public" : "collaborative";
        const { data: image } = await adminClient
            .from("eventin_gallery_images")
            .select("id,event_id,gallery_type,storage_path,thumbnail_storage_path")
            .eq("id", imageId)
            .eq("gallery_type", galleryType)
            .maybeSingle();

        if (!image) {
            return jsonResponse({ error: "Image not found" }, 404);
        }

        const eventData = await getEventById(image.event_id);
        const profile = await getProfile();
        const canDelete = Boolean(profile && eventData && (
            profile.role === "admin"
            || profile.event_code === eventData.event_code
        ));

        if (!canDelete) {
            return jsonResponse({ error: "Access denied" }, 403);
        }

        const pathsToRemove = [image.storage_path, image.thumbnail_storage_path].filter(Boolean);
        const { error: removeError } = await adminClient.storage.from(bucketName).remove(pathsToRemove);
        if (removeError) {
            console.error("Gallery delete failed", removeError);
            return jsonResponse({ error: "Could not delete image" }, 502);
        }

        await adminClient.from("eventin_gallery_images").delete().eq("id", image.id);
        return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
});
