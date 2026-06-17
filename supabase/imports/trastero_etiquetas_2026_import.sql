-- Importacion puntual de carpetas e items desde Etiquetas 2026.docx.
-- Ejecutar manualmente en Supabase SQL Editor.
-- Fuente: V:\Desc\2026\Etiquetas 2026.docx
-- Detectadas 44 paginas: 37 carpetas activas por defecto, 193 items,
-- 2 paginas marcadas como NO EXISTE/OLD y 4 carpetas sin items omitidas por defecto.
--
-- Antes de ejecutar:
-- 1) Cambia v_user_email por el email del usuario propietario en Supabase Auth.
-- 2) Si quieres meter tambien carpetas marcadas como NO EXISTE/OLD o carpetas sin items,
--    cambia los flags correspondientes a true.

begin;

do $$
declare
    v_user_email text := 'CAMBIAR_EMAIL@EJEMPLO.COM';
    v_importar_no_existe boolean := false;
    v_importar_carpetas_sin_items boolean := false;
    v_user_id uuid;
    v_carpeta_id bigint;
    v_item text;
    v_marker text;
    v_carpeta record;
begin
    select id
    into v_user_id
    from auth.users
    where email = v_user_email
    limit 1;

    if v_user_id is null then
        raise exception 'No existe ningun usuario en auth.users con email %', v_user_email;
    end if;

    for v_carpeta in
        select *
        from (values
        (1, 'activa', 'FONTANERIA', array['PINTURA', 'FIJACIONES', 'ANCLAJES', 'TORNILLERIA', 'ELECTRICIDAD', 'CARPINTERIA METALICA', 'CERRAMIENTOS', 'MANUALIDADES', 'LIMPIEZA AUTOMOVIL', 'UTILES', 'HERRAMIENTAS', 'OLD – NO EXISTE', 'CAJA P8', 'MALETA PADEL', 'CAJA CAMARA DE SEGURIDAD GARAJE']::text[]),
        (2, 'activa', 'CAJA 29', array['ARBOL DE NAVIDAD']::text[]),
        (3, 'activa', 'CAJA 27', array['AMPLIFICADOR DENON']::text[]),
        (4, 'activa', 'CAJA V8', array['VALENTINA INVIERNO 8 AÑOS']::text[]),
        (5, 'activa', 'CAJA V8', array['VALENTINA INVIERNO 8 AÑOS']::text[]),
        (6, 'activa', 'CAJA V7-8', array['VALENTINA INVIERNO 7 AÑOS', 'VALENTINA INVIERNO 8 AÑOS']::text[]),
        (7, 'activa', 'CAJA 8', array['BOLSAS IKEA Y NAVIDAD', 'PLANTAS IKEA', 'GIRNALDA BOLAS LUCES DE', 'COLORES', 'BALDAS IKEA MUEBLE ESTUDIO']::text[]),
        (8, 'activa', 'CAJA 1', array['CUBOS PINTURA', 'COMPRESOR', 'CAJAS FOCOS SOLARES PATIO', 'CASPSULAS HUEVOS KINDER', 'RODILLOS PINTURAS', 'FILM ENVALAR', 'PALETAS ESCAYOLA CUADROS', 'RUEDAS SILLON PALÉ', 'POMO KOMERLING', 'MAZA DE GOMA', 'VINILO MESA DE VALENTINA (MADERA)', 'TUBOS DESAGÜE LAVABO CORRUGAO', 'LECHÁ']::text[]),
        (9, 'sin_objetos', 'CAJA 1', array[]::text[]),
        (10, 'sin_objetos', 'CAJA 1', array[]::text[]),
        (11, 'sin_objetos', 'CAJA 1', array[]::text[]),
        (12, 'activa', 'CAJA T5', array['RELLENOS CUNA', 'RULITOS', 'FUNDAS CUCO', 'SACO DORMIR', 'VENTAS 1ª POSTURA VERANO', 'VENTAS 1ª POSTURA INVIERNO']::text[]),
        (13, 'activa', 'CAJA 3', array['VALENTINA ZAPATOS INVIERNO', 'VALENTINA ZAPATOS VERANO', 'A PARTIR DEL 31']::text[]),
        (14, 'no_existe', 'NO EXISTE – SE HAN SACADO LAS CAJAS PEQUEÑAS', array['CAJA 9', 'UNION DE CAJAS', 'CARGADORES PORTÁTIL', 'PIE TV 65" SALÓN', 'BOSE CABLES', 'BOSE ALTAVOCES']::text[]),
        (15, 'activa', 'CAJA T1', array['VENTAS ULTIMAS']::text[]),
        (16, 'activa', 'CAJA T4 – VENTAS', array['SACOS BUGABOO', 'FUNDA SILLAS', 'CAPOTA', 'SÁBANAS']::text[]),
        (17, 'activa', 'CAJA T3 – VENTAS', array['CAMISETAS', 'PANTALONES', 'SUDADERAS', 'CAMISAS']::text[]),
        (18, 'activa', 'CAJA T6 – VENTAS', array['VENTAS VERANO', 'DESDE 1 AÑO']::text[]),
        (19, 'activa', 'CAJA 5', array['MUÑECOS', 'PELUCHES']::text[]),
        (20, 'activa', 'CAJA 11- CAJAS DISPOSITIVOS', array['JAZZTEL ROUTER', 'LOGITECH K270 TECLADO', 'LOGITECH MX MASTER RATÓN', '*WD TV', 'GARMIN 735', 'GARMIN FORERUNNER 610', 'GARMIN VIVOFIT', 'CANON EOS CÁMARA', 'CANON OBJETIVO 18-200MM', 'CANON OBJETIVO 50MM', 'CANON OBJETIVO CANON 24MM', 'APPLE CAJAS IPHONE', 'APPLE IPOD NANO', 'APPLE TV', 'APPLE IPAD PRO', 'APPLE FUNDA IPAD', 'CÁMARA DEPORTIVA SJCAM', '*SYNOLOGY DS215J', 'MACBOOK PRO', 'BODA', 'AUDI A4 AVANT', 'APPLE AIR TAG', 'MANDO/MICRO PLAY 3', 'PIE TV 75” SOTANO', 'Tuerca Home Cinema Yamaha', 'TECLADO Y CABLE IMAC', 'PIE MONITOR DELL', 'CAJA AUR. OPPO', 'CAJA SOP. MONITOR PLADUR', 'FIRE STICK 4K', 'BRAUN SILK-EPIL', 'CAJA 11- CAJAS DISPOSITIVOS']::text[]),
        (22, 'activa', 'CAJA 51', array['DAI', 'PDA ABUELO', 'FOTOS', 'CDS SOFTWARE', 'ALTAVOCES JBL PC', 'BUHOS', 'CARTUCHO', 'NINTENDO', 'MINI DISC', 'ANTENA DENON', 'CARCASAS HD', 'EXTERN', 'RADIOS', 'ANTENA FM YAMAHA', 'SOPORTE BARRA', 'SONID', 'TAPAS TV']::text[]),
        (23, 'activa', 'CAJA 10 – MOCHILAS', array['CAMELBAK LOBO', 'CAMINO SANTIAGO', 'WILSON', 'BLANCO DECATHLON', 'CELESTE PULL', 'JIP CARBONO', 'PALAS PADEL + PELOTAS + MUÑEQUERA', 'NECESER ROCIO']::text[]),
        (24, 'activa', 'CAJA 4', array['VALENTINA VERANO 7 AÑOS', 'VALENTINA VERANO 8 AÑOS']::text[]),
        (25, 'sin_objetos', 'CAJA 4', array[]::text[]),
        (26, 'activa', 'CAJA Home Cinema', array['NAVIDAD', 'BELEN', 'BOLAS', 'ADORNOS']::text[]),
        (27, 'no_existe', 'OLD – NO EXISTE', array['CAJA 2', 'FONTANERIA', 'ELECTRICIDAD', 'CABLES', 'DUCHAS', 'SOPORTE MONITOR PLATA', 'SOPORTE MONITOR EXTENSIBLE', 'PORTERO AUTOMATICO', 'DORSALES BICICLETA', 'SWITCH DLINK']::text[]),
        (28, 'activa', 'CAJA 2', array['PUERTA LAVADORA', 'CADENAS NIEVE', 'PINCHOS SOMBRILLA', 'PALAS ARENA PLAYA', 'VINILO CRISTAL OPACO', 'TABLA NATACIÓN', 'COMETA', 'PELOTA TENIS GRANDE']::text[]),
        (29, 'activa', 'CAJA 7', array['MONITOR AOC', 'PLAY STATION 3', 'FUNDA CD / SOBRES', 'DVD SERIES MALETÍN', 'CARGADOR PORTÁTIL', 'TECLADO LOGITECH', 'MALETINES DVD', 'TECLADO + RATÓN DELL', 'PALAS PING PONG']::text[]),
        (30, 'activa', 'CAJA V10', array['VALENTINA 8 VERANO-INVIERNO', 'VALENTINA 9 VERANO-INVIERNO', 'VALENTINA 10 VERANO-INVIERNO']::text[]),
        (31, 'activa', 'CAJA – VENTA ZAPATOS', array['(PUEDE NO ESTAR – REORGANIZACION ROCIO)', 'ZAPATOS (nºT7) (CAJA ALVARO MORENO)']::text[]),
        (32, 'activa', 'CAJA 52', array['COSTALERO', 'PADEL', 'RUNNING', 'FÚTBOL', 'RODILLO']::text[]),
        (33, 'activa', 'CAJA 30', array['FONTANERIA', 'EMPAQUETADA EN: CAJA 2']::text[]),
        (34, 'activa', 'CAJA 31', array['ELECTRICIDAD', 'EMPAQUETADA EN: CAJA 2']::text[]),
        (35, 'activa', 'CAJA 25', array['ALTAVOCES BOSE', 'EMPAQUETADA EN: CAJA 9']::text[]),
        (36, 'activa', 'CAJA 26', array['CABLES EQUIPO BOSE', 'EMPAQUETADA EN: CAJA 9']::text[]),
        (37, 'activa', 'CAJA 28', array['PIE TV 65” SALON', 'EMPAQUETADA EN: CAJA 9']::text[]),
        (38, 'activa', 'CAJA 32', array['CARGADORES PORTATILES', 'EMPAQUETADA EN: CAJA 9']::text[]),
        (39, 'activa', 'CAJAS CABLES', array['CORRIENTE (TRIPLE HILO)', 'CORRIENTE (EN 8, DOBLE HILO)', 'CARGADORES MICRO', 'USB', 'ANTENA', 'HDMI', 'RED', 'USB', 'AUDIO FIBRA', 'AUDIO RCA', 'USB IMPRESORA', 'VGA', 'DVI', 'USB ALARGADERA', 'AUDIO JACK', 'SATA', 'AURICULARES', 'MODEN USB', 'FIBRA OPTICA', 'INTERNET']::text[]),
        (40, 'activa', 'CAJA 14', array['HOME CINEMA YAMAHA']::text[]),
        (41, 'activa', 'CAJA 2', array['9 AÑOS INVIERNO / VERANO', 'VALENTINA 9 AÑOS INVIERNO Y VERANO']::text[]),
        (42, 'activa', 'CAJA 2', array['9 AÑOS INVIERNO / VERANO']::text[]),
        (43, 'activa', 'VENTAS INVIERNO', array['DESDE 1 AÑO']::text[]),
        (44, 'activa', 'DUCHAS', array['RECAMBIOS DUCHAS', 'SWITCH DE LINK', 'PORTERO AUTOMÁTICO GOLMAR', 'DORSALES DE CARRERAS', 'SOPORTES DE MONITOR']::text[])
        ) as datos(pagina, estado, carpeta_nombre, items)
    loop
        if v_carpeta.estado = 'no_existe' and not v_importar_no_existe then
            continue;
        end if;

        if v_carpeta.estado = 'sin_objetos' and not v_importar_carpetas_sin_items then
            continue;
        end if;

        v_marker := format('[import:etiquetas-2026:pagina=%s]', v_carpeta.pagina);

        select id
        into v_carpeta_id
        from public.trastero_carpetas
        where user_id = v_user_id
          and notas = v_marker
        order by id
        limit 1;

        if v_carpeta_id is null then
            insert into public.trastero_carpetas (user_id, parent_id, nombre, codigo, notas)
            values (v_user_id, null, v_carpeta.carpeta_nombre, null, v_marker)
            returning id into v_carpeta_id;
        end if;

        foreach v_item in array v_carpeta.items
        loop
            if nullif(trim(v_item), '') is null then
                continue;
            end if;

            if not exists (
                select 1
                from public.trastero_items
                where user_id = v_user_id
                  and carpeta_id = v_carpeta_id
                  and nombre = v_item
            ) then
                insert into public.trastero_items (user_id, carpeta_id, nombre, cantidad, unidad, notas)
                values (v_user_id, v_carpeta_id, v_item, 1, 'unit', null);
            end if;
        end loop;
    end loop;
end $$;

commit;

-- Comprobacion posterior de lo importado:
-- select c.nombre as carpeta, count(i.id) as items
-- from public.trastero_carpetas c
-- left join public.trastero_items i on i.carpeta_id = c.id
-- where c.notas like '[import:etiquetas-2026:pagina=%]'
-- group by c.id, c.nombre
-- order by c.id;
