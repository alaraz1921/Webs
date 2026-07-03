const EscapeTinMedia = (() => {
    const MAX_BYTES = 300 * 1024;
    const BUCKET = "escapetin-uploads";

    function safeName(name, fallback = "imagen.jpg") {
        return String(name || fallback).replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
    }

    function isMobileDevice() {
        return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
    }

    function configureImageInput(input) {
        if (!input) return;
        input.type = "file";
        input.accept = "image/*";
        if (isMobileDevice()) input.setAttribute("capture", "environment");
        else input.removeAttribute("capture");
    }

    function canvasToBlob(canvas, quality) {
        return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }

    async function compressImage(file, maxBytes = MAX_BYTES) {
        if (!file || !file.type?.startsWith("image/")) return file;
        const bitmap = await createImageBitmap(file);
        let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        let quality = 0.86;
        let blob = null;

        for (let attempt = 0; attempt < 12; attempt += 1) {
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const ctx = canvas.getContext("2d", { alpha: false });
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            blob = await canvasToBlob(canvas, quality);
            if (blob && blob.size <= maxBytes) break;
            if (quality > 0.55) quality -= 0.08;
            else scale *= 0.82;
        }

        return new File([blob || file], safeName(file.name).replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
    }

    async function uploadImage(client, file, folder = "general") {
        if (!file) return "";
        const compressed = await compressImage(file);
        const path = `${folder}/${Date.now()}-${safeName(compressed.name)}`;
        const { error } = await client.storage.from(BUCKET).upload(path, compressed, {
            cacheControl: "3600",
            upsert: false,
            contentType: compressed.type || "image/jpeg"
        });
        if (error) throw error;
        const { data } = client.storage.from(BUCKET).getPublicUrl(path);
        return data.publicUrl;
    }

    return { MAX_BYTES, configureImageInput, compressImage, uploadImage };
})();