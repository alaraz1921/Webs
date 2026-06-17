-- Importacion puntual para la nueva estructura de Trastero desde Importacion Etiquetas.xlsx.
-- Ejecutar manualmente en Supabase SQL Editor DESPUES de aplicar:
-- supabase/migrations/20260617090000_trastero_carpetas_items.sql
--
-- Fuente: V:\Desc\2026\Importacion Etiquetas.xlsx
-- Hoja: Hoja1
-- Filas validas: 206 (45 carpetas, 161 filas de item).
-- Items finales a importar: 160; duplicados exactos agrupados por cantidad: 1.
-- Carpetas raiz: 31; items raiz: 0.
--
-- Reglas usadas:
-- - EsCarpeta = 'T' importa una fila en trastero_carpetas.
-- - EsItem = 'T' importa una fila en trastero_items.
-- - EnCarpeta se resuelve primero contra Codigo de carpeta y despues contra Nombre.
-- - Si EnCarpeta esta vacio, el elemento queda en raiz.
-- - Las carpetas se identifican por Codigo para que el script sea reejecutable.
-- - Los items se identifican por carpeta + nombre + codigo + nota; duplicados exactos se agrupan en cantidad.

begin;

do $$
declare
    v_user_email text := 'CAMBIAR_EMAIL@EJEMPLO.COM';
    v_user_id uuid;
    v_carpeta record;
    v_item record;
    v_parent_id bigint;
    v_folder_id bigint;
    v_item_id bigint;
    v_pending integer;
    v_inserted integer;
begin
    select id
    into v_user_id
    from auth.users
    where email = v_user_email
    limit 1;

    if v_user_id is null then
        raise exception 'No existe ningun usuario en auth.users con email %', v_user_email;
    end if;

    create temp table if not exists tmp_trastero_import_carpetas (
        linea integer primary key,
        nombre text not null,
        codigo text not null,
        en_carpeta text null,
        nota text null,
        imported_id bigint null
    ) on commit drop;

    create temp table if not exists tmp_trastero_import_items (
        linea integer primary key,
        nombre text not null,
        codigo text null,
        en_carpeta text null,
        nota text null,
        cantidad numeric not null default 1,
        lineas_origen text null
    ) on commit drop;

    truncate tmp_trastero_import_carpetas;
    truncate tmp_trastero_import_items;

    insert into tmp_trastero_import_carpetas (linea, nombre, codigo, en_carpeta, nota)
    values
        (2, 'GARAJE', 'GARAJE', null, null),
        (3, 'ESTANTERIA DERECHA', 'EST-D', 'GARAJE', null),
        (4, 'ESTANTERIA IZQUIERDA', 'EST-I', 'GARAJE', null),
        (5, 'FONTANERIA', '30', 'EST-D', null),
        (6, 'PINTURA', 'PINTURA', 'EST-D', null),
        (7, 'FIJACIONES ANCLAJES TORNILLERIA', 'TORNILLERIA', 'EST-D', null),
        (8, 'ELECTRICIDAD', '31', 'EST-D', null),
        (9, 'CARPINTERIA METALICA', 'CARP. METALICA', 'EST-D', null),
        (10, 'CERRAMIENTOS', 'CERRAMIENTOS', 'EST-D', null),
        (11, 'MANUALIDADES', 'MANUALIDADES', 'EST-D', null),
        (12, 'LIMPIEZA AUTOMOVIL', 'LIMPIEZA AUTO', null, null),
        (13, 'UTILES HERRAMIENTAS', 'UTILES', null, null),
        (14, 'ARBOL NAVIDAD', '29', 'EST-D', null),
        (16, 'DENON', '27', null, null),
        (18, 'VALENTINA INVIERNO 8 AÑOS', 'V8', null, null),
        (20, 'INVIERNO 7-8 AÑOS', 'V7-8', null, null),
        (23, 'CAJA 8', '8', null, null),
        (29, 'CAJA 1', '1', null, null),
        (43, 'CAJA T5', 'T5', null, null),
        (50, 'CAJA 3', '3', null, null),
        (54, 'CARGADORES PORTÁTIL', '32', null, null),
        (55, 'PIE TV 65" SALÓN', '28', null, null),
        (56, 'BOSE CABLES', '26', null, null),
        (57, 'BOSE ALTAVOCES', '25', null, null),
        (58, 'CAJA T1', 'T1', null, null),
        (60, 'CAJA T4 – VENTAS', 'T4-VENTAS', 'EST-I', null),
        (65, 'CAJA T3 – VENTAS', 'T3-VENTAS', 'EST-I', null),
        (70, 'CAJA T6 – VENTAS', 'T6-VENTAS', 'EST-I', null),
        (73, 'CAJA 5', '5', null, null),
        (76, 'CAJAS DISPOSITIVOS', '11', null, null),
        (108, 'CAJA 51', '51', null, null),
        (126, 'MOCHILAS', '10', null, null),
        (135, 'VERANO 7-8 AÑOS', '4', null, null),
        (138, 'CAJA Home Cinema', 'Home Cinema', null, null),
        (143, 'CAJA 2', '2', null, null),
        (152, 'CAJA 7', '7', null, null),
        (162, 'CAJA V10', 'V10', null, null),
        (166, 'VENTA ZAPATOS', 'VENTA ZAPATOS', null, 'PUEDE NO ESTAR – REORGANIZACION ROCIO'),
        (167, 'ZAPATOS', 'T7', null, 'CAJA ALVARO MORENO'),
        (168, 'CAJA 52', '52', null, null),
        (174, 'CAJAS CABLES', 'CABLES', null, null),
        (195, 'CAJA 14', '14', null, null),
        (197, 'CAJA 2B', 'CAJA 2B', null, null),
        (200, 'VENTAS INVIERNO', 'VENTAS INVIERNO', 'EST-I', null),
        (202, 'DUCHAS', 'DUCHAS', null, null);

    insert into tmp_trastero_import_items (linea, nombre, codigo, en_carpeta, nota, cantidad, lineas_origen)
    values
        (15, 'ARBOL DE NAVIDAD', null, '29', null, 1, '15'),
        (17, 'AMPLIFICADOR DENON', null, '27', null, 1, '17'),
        (19, 'VALENTINA INVIERNO 8 AÑOS', null, 'V8', null, 1, '19'),
        (21, 'VALENTINA INVIERNO 7 AÑOS', null, 'V7-8', null, 1, '21'),
        (22, 'VALENTINA INVIERNO 8 AÑOS', null, 'V7-8', null, 1, '22'),
        (24, 'BOLSAS IKEA Y NAVIDAD', null, '8', null, 1, '24'),
        (25, 'PLANTAS IKEA', null, '8', null, 1, '25'),
        (26, 'GIRNALDA BOLAS LUCES DE', null, '8', null, 1, '26'),
        (27, 'COLORES', null, '8', null, 1, '27'),
        (28, 'BALDAS IKEA MUEBLE ESTUDIO', null, '8', null, 1, '28'),
        (30, 'CUBOS PINTURA', null, '1', null, 1, '30'),
        (31, 'COMPRESOR', null, '1', null, 1, '31'),
        (32, 'CAJAS FOCOS SOLARES PATIO', null, '1', null, 1, '32'),
        (33, 'CASPSULAS HUEVOS KINDER', null, '1', null, 1, '33'),
        (34, 'RODILLOS PINTURAS', null, '1', null, 1, '34'),
        (35, 'FILM ENVALAR', null, '1', null, 1, '35'),
        (36, 'PALETAS ESCAYOLA CUADROS', null, '1', null, 1, '36'),
        (37, 'RUEDAS SILLON PALÉ', null, '1', null, 1, '37'),
        (38, 'POMO KOMERLING', null, '1', null, 1, '38'),
        (39, 'MAZA DE GOMA', null, '1', null, 1, '39'),
        (40, 'VINILO MESA DE VALENTINA (MADERA)', null, '1', null, 1, '40'),
        (41, 'TUBOS DESAGÜE LAVABO CORRUGAO', null, '1', null, 1, '41'),
        (42, 'LECHÁ', null, '1', null, 1, '42'),
        (44, 'RELLENOS CUNA', null, 'T5', null, 1, '44'),
        (45, 'RULITOS', null, 'T5', null, 1, '45'),
        (46, 'FUNDAS CUCO', null, 'T5', null, 1, '46'),
        (47, 'SACO DORMIR', null, 'T5', null, 1, '47'),
        (48, 'VENTAS 1ª POSTURA VERANO', null, 'T5', null, 1, '48'),
        (49, 'VENTAS 1ª POSTURA INVIERNO', null, 'T5', null, 1, '49'),
        (51, 'VALENTINA ZAPATOS INVIERNO', null, '3', null, 1, '51'),
        (52, 'VALENTINA ZAPATOS VERANO', null, '3', null, 1, '52'),
        (53, 'A PARTIR DEL 31', null, '3', null, 1, '53'),
        (59, 'VENTAS ULTIMAS', null, 'T1', null, 1, '59'),
        (61, 'SACOS BUGABOO', null, 'T4-VENTAS', null, 1, '61'),
        (62, 'FUNDA SILLAS', null, 'T4-VENTAS', null, 1, '62'),
        (63, 'CAPOTA', null, 'T4-VENTAS', null, 1, '63'),
        (64, 'SÁBANAS', null, 'T4-VENTAS', null, 1, '64'),
        (66, 'CAMISETAS', null, 'T3-VENTAS', null, 1, '66'),
        (67, 'PANTALONES', null, 'T3-VENTAS', null, 1, '67'),
        (68, 'SUDADERAS', null, 'T3-VENTAS', null, 1, '68'),
        (69, 'CAMISAS', null, 'T3-VENTAS', null, 1, '69'),
        (71, 'VENTAS VERANO', null, 'T6-VENTAS', null, 1, '71'),
        (72, 'DESDE 1 AÑO', null, 'T6-VENTAS', null, 1, '72'),
        (74, 'MUÑECOS', null, '5', null, 1, '74'),
        (75, 'PELUCHES', null, '5', null, 1, '75'),
        (77, 'JAZZTEL ROUTER', null, '11', null, 1, '77'),
        (78, 'LOGITECH K270 TECLADO', null, '11', null, 1, '78'),
        (79, 'LOGITECH MX MASTER RATÓN', null, '11', null, 1, '79'),
        (80, '*WD TV', null, '11', null, 1, '80'),
        (81, 'GARMIN 735', null, '11', null, 1, '81'),
        (82, 'GARMIN FORERUNNER 610', null, '11', null, 1, '82'),
        (83, 'GARMIN VIVOFIT', null, '11', null, 1, '83'),
        (84, 'CANON EOS CÁMARA', null, '11', null, 1, '84'),
        (85, 'CANON OBJETIVO 18-200MM', null, '11', null, 1, '85'),
        (86, 'CANON OBJETIVO 50MM', null, '11', null, 1, '86'),
        (87, 'CANON OBJETIVO CANON 24MM', null, '11', null, 1, '87'),
        (88, 'APPLE CAJAS IPHONE', null, '11', null, 1, '88'),
        (89, 'APPLE IPOD NANO', null, '11', null, 1, '89'),
        (90, 'APPLE TV', null, '11', null, 1, '90'),
        (91, 'APPLE IPAD PRO', null, '11', null, 1, '91'),
        (92, 'APPLE FUNDA IPAD', null, '11', null, 1, '92'),
        (93, 'CÁMARA DEPORTIVA SJCAM', null, '11', null, 1, '93'),
        (94, '*SYNOLOGY DS215J', null, '11', null, 1, '94'),
        (95, 'MACBOOK PRO', null, '11', null, 1, '95'),
        (96, 'BODA', null, '11', null, 1, '96'),
        (97, 'AUDI A4 AVANT', null, '11', null, 1, '97'),
        (98, 'APPLE AIR TAG', null, '11', null, 1, '98'),
        (99, 'MANDO/MICRO PLAY 3', null, '11', null, 1, '99'),
        (100, 'PIE TV 75” SOTANO', null, '11', null, 1, '100'),
        (101, 'Tuerca Home Cinema Yamaha', null, '11', null, 1, '101'),
        (102, 'TECLADO Y CABLE IMAC', null, '11', null, 1, '102'),
        (103, 'PIE MONITOR DELL', null, '11', null, 1, '103'),
        (104, 'CAJA AUR. OPPO', null, '11', null, 1, '104'),
        (105, 'CAJA SOP. MONITOR PLADUR', null, '11', null, 1, '105'),
        (106, 'FIRE STICK 4K', null, '11', null, 1, '106'),
        (107, 'BRAUN SILK-EPIL', null, '11', null, 1, '107'),
        (109, 'DAI', null, '51', null, 1, '109'),
        (110, 'PDA ABUELO', null, '51', null, 1, '110'),
        (111, 'FOTOS', null, '51', null, 1, '111'),
        (112, 'CDS SOFTWARE', null, '51', null, 1, '112'),
        (113, 'ALTAVOCES JBL PC', null, '51', null, 1, '113'),
        (114, 'BUHOS', null, '51', null, 1, '114'),
        (115, 'CARTUCHO', null, '51', null, 1, '115'),
        (116, 'NINTENDO', null, '51', null, 1, '116'),
        (117, 'MINI DISC', null, '51', null, 1, '117'),
        (118, 'ANTENA DENON', null, '51', null, 1, '118'),
        (119, 'CARCASAS HD', null, '51', null, 1, '119'),
        (120, 'EXTERN', null, '51', null, 1, '120'),
        (121, 'RADIOS', null, '51', null, 1, '121'),
        (122, 'ANTENA FM YAMAHA', null, '51', null, 1, '122'),
        (123, 'SOPORTE BARRA', null, '51', null, 1, '123'),
        (124, 'SONID', null, '51', null, 1, '124'),
        (125, 'TAPAS TV', null, '51', null, 1, '125'),
        (127, 'CAMELBAK LOBO', null, '10', null, 1, '127'),
        (128, 'CAMINO SANTIAGO', null, '10', null, 1, '128'),
        (129, 'WILSON', null, '10', null, 1, '129'),
        (130, 'BLANCO DECATHLON', null, '10', null, 1, '130'),
        (131, 'CELESTE PULL', null, '10', null, 1, '131'),
        (132, 'JIP CARBONO', null, '10', null, 1, '132'),
        (133, 'PALAS PADEL + PELOTAS + MUÑEQUERA', null, '10', null, 1, '133'),
        (134, 'NECESER ROCIO', null, '10', null, 1, '134'),
        (136, 'VALENTINA VERANO 7 AÑOS', null, '4', null, 1, '136'),
        (137, 'VALENTINA VERANO 8 AÑOS', null, '4', null, 1, '137'),
        (139, 'NAVIDAD', null, 'Home Cinema', null, 1, '139'),
        (140, 'BELEN', null, 'Home Cinema', null, 1, '140'),
        (141, 'BOLAS', null, 'Home Cinema', null, 1, '141'),
        (142, 'ADORNOS', null, 'Home Cinema', null, 1, '142'),
        (144, 'PUERTA LAVADORA', null, '2', null, 1, '144'),
        (145, 'CADENAS NIEVE', null, '2', null, 1, '145'),
        (146, 'PINCHOS SOMBRILLA', null, '2', null, 1, '146'),
        (147, 'PALAS ARENA PLAYA', null, '2', null, 1, '147'),
        (148, 'VINILO CRISTAL OPACO', null, '2', null, 1, '148'),
        (149, 'TABLA NATACIÓN', null, '2', null, 1, '149'),
        (150, 'COMETA', null, '2', null, 1, '150'),
        (151, 'PELOTA TENIS GRANDE', null, '2', null, 1, '151'),
        (153, 'MONITOR AOC', null, '7', null, 1, '153'),
        (154, 'PLAY STATION 3', null, '7', null, 1, '154'),
        (155, 'FUNDA CD / SOBRES', null, '7', null, 1, '155'),
        (156, 'DVD SERIES MALETÍN', null, '7', null, 1, '156'),
        (157, 'CARGADOR PORTÁTIL', null, '7', null, 1, '157'),
        (158, 'TECLADO LOGITECH', null, '7', null, 1, '158'),
        (159, 'MALETINES DVD', null, '7', null, 1, '159'),
        (160, 'TECLADO + RATÓN DELL', null, '7', null, 1, '160'),
        (161, 'PALAS PING PONG', null, '7', null, 1, '161'),
        (163, 'VALENTINA 8 VERANO-INVIERNO', null, 'V10', null, 1, '163'),
        (164, 'VALENTINA 9 VERANO-INVIERNO', null, 'V10', null, 1, '164'),
        (165, 'VALENTINA 10 VERANO-INVIERNO', null, 'V10', null, 1, '165'),
        (169, 'COSTALERO', null, '52', null, 1, '169'),
        (170, 'PADEL', null, '52', null, 1, '170'),
        (171, 'RUNNING', null, '52', null, 1, '171'),
        (172, 'FÚTBOL', null, '52', null, 1, '172'),
        (173, 'RODILLO', null, '52', null, 1, '173'),
        (175, 'CORRIENTE (TRIPLE HILO)', null, 'CABLES', null, 1, '175'),
        (176, 'CORRIENTE (EN 8, DOBLE HILO)', null, 'CABLES', null, 1, '176'),
        (177, 'CARGADORES MICRO', null, 'CABLES', null, 1, '177'),
        (178, 'USB', null, 'CABLES', null, 2, '178, 182'),
        (179, 'ANTENA', null, 'CABLES', null, 1, '179'),
        (180, 'HDMI', null, 'CABLES', null, 1, '180'),
        (181, 'RED', null, 'CABLES', null, 1, '181'),
        (183, 'AUDIO FIBRA', null, 'CABLES', null, 1, '183'),
        (184, 'AUDIO RCA', null, 'CABLES', null, 1, '184'),
        (185, 'USB IMPRESORA', null, 'CABLES', null, 1, '185'),
        (186, 'VGA', null, 'CABLES', null, 1, '186'),
        (187, 'DVI', null, 'CABLES', null, 1, '187'),
        (188, 'USB ALARGADERA', null, 'CABLES', null, 1, '188'),
        (189, 'AUDIO JACK', null, 'CABLES', null, 1, '189'),
        (190, 'SATA', null, 'CABLES', null, 1, '190'),
        (191, 'AURICULARES', null, 'CABLES', null, 1, '191'),
        (192, 'MODEN USB', null, 'CABLES', null, 1, '192'),
        (193, 'FIBRA OPTICA', null, 'CABLES', null, 1, '193'),
        (194, 'INTERNET', null, 'CABLES', null, 1, '194'),
        (196, 'HOME CINEMA YAMAHA', null, '14', null, 1, '196'),
        (198, '9 AÑOS INVIERNO / VERANO', null, 'CAJA 2B', null, 1, '198'),
        (199, 'VALENTINA 9 AÑOS INVIERNO Y VERANO', null, 'CAJA 2B', null, 1, '199'),
        (201, 'DESDE 1 AÑO', null, 'VENTAS INVIERNO', null, 1, '201'),
        (203, 'RECAMBIOS DUCHAS', null, 'DUCHAS', null, 1, '203'),
        (204, 'SWITCH DE LINK', null, 'DUCHAS', null, 1, '204'),
        (205, 'PORTERO AUTOMÁTICO GOLMAR', null, 'DUCHAS', null, 1, '205'),
        (206, 'DORSALES DE CARRERAS', null, 'DUCHAS', null, 1, '206'),
        (207, 'SOPORTES DE MONITOR', null, 'DUCHAS', null, 1, '207');

    if exists (
        select 1
        from tmp_trastero_import_carpetas
        where nullif(trim(nombre), '') is null or nullif(trim(codigo), '') is null
    ) then
        raise exception 'Hay carpetas sin Nombre o Codigo. Revisa el Excel.';
    end if;

    if exists (
        select codigo
        from tmp_trastero_import_carpetas
        group by codigo
        having count(*) > 1
    ) then
        raise exception 'Hay codigos de carpeta duplicados. Revisa el Excel.';
    end if;

    if exists (
        select 1
        from tmp_trastero_import_carpetas child
        where child.en_carpeta is not null
          and not exists (
              select 1
              from tmp_trastero_import_carpetas parent
              where parent.codigo = child.en_carpeta or parent.nombre = child.en_carpeta
          )
    ) then
        raise exception 'Hay carpetas con EnCarpeta sin coincidencia por Codigo o Nombre.';
    end if;

    if exists (
        select 1
        from tmp_trastero_import_items item
        where item.en_carpeta is not null
          and not exists (
              select 1
              from tmp_trastero_import_carpetas folder
              where folder.codigo = item.en_carpeta or folder.nombre = item.en_carpeta
          )
    ) then
        raise exception 'Hay items con EnCarpeta sin coincidencia por Codigo o Nombre.';
    end if;

    loop
        v_inserted := 0;

        for v_carpeta in
            select *
            from tmp_trastero_import_carpetas
            where imported_id is null
            order by linea
        loop
            v_parent_id := null;

            if v_carpeta.en_carpeta is not null then
                select imported_id
                into v_parent_id
                from tmp_trastero_import_carpetas
                where codigo = v_carpeta.en_carpeta or nombre = v_carpeta.en_carpeta
                order by case when codigo = v_carpeta.en_carpeta then 0 else 1 end, linea
                limit 1;

                if v_parent_id is null then
                    continue;
                end if;
            end if;

            select id
            into v_folder_id
            from public.trastero_carpetas
            where user_id = v_user_id
              and codigo = v_carpeta.codigo
            order by id
            limit 1;

            if v_folder_id is null then
                insert into public.trastero_carpetas (user_id, parent_id, nombre, codigo, notas)
                values (v_user_id, v_parent_id, v_carpeta.nombre, v_carpeta.codigo, v_carpeta.nota)
                returning id into v_folder_id;
            else
                update public.trastero_carpetas
                set parent_id = v_parent_id,
                    nombre = v_carpeta.nombre,
                    notas = v_carpeta.nota
                where id = v_folder_id;
            end if;

            update tmp_trastero_import_carpetas
            set imported_id = v_folder_id
            where linea = v_carpeta.linea;

            v_inserted := v_inserted + 1;
        end loop;

        select count(*)
        into v_pending
        from tmp_trastero_import_carpetas
        where imported_id is null;

        exit when v_pending = 0;

        if v_inserted = 0 then
            raise exception 'No se pudieron resolver algunas carpetas. Posible ciclo o EnCarpeta ambiguo.';
        end if;
    end loop;

    for v_item in
        select *
        from tmp_trastero_import_items
        order by linea
    loop
        v_parent_id := null;

        if v_item.en_carpeta is not null then
            select imported_id
            into v_parent_id
            from tmp_trastero_import_carpetas
            where codigo = v_item.en_carpeta or nombre = v_item.en_carpeta
            order by case when codigo = v_item.en_carpeta then 0 else 1 end, linea
            limit 1;
        end if;

        select id
        into v_item_id
        from public.trastero_items
        where user_id = v_user_id
          and carpeta_id is not distinct from v_parent_id
          and nombre = v_item.nombre
          and codigo is not distinct from v_item.codigo
          and notas is not distinct from v_item.nota
        order by id
        limit 1;

        if v_item_id is null then
            insert into public.trastero_items (user_id, carpeta_id, nombre, codigo, cantidad, unidad, notas)
            values (v_user_id, v_parent_id, v_item.nombre, v_item.codigo, v_item.cantidad, 'unit', v_item.nota);
        else
            update public.trastero_items
            set carpeta_id = v_parent_id,
                codigo = v_item.codigo,
                cantidad = v_item.cantidad,
                unidad = 'unit',
                notas = v_item.nota
            where id = v_item_id;
        end if;
    end loop;

    raise notice 'Importacion completada: % carpetas, % items.',
        (select count(*) from tmp_trastero_import_carpetas),
        (select count(*) from tmp_trastero_import_items);
end $$;

commit;

-- Comprobacion posterior:
-- select c.nombre, c.codigo, p.nombre as en_carpeta
-- from public.trastero_carpetas c
-- left join public.trastero_carpetas p on p.id = c.parent_id
-- order by c.id;
--
-- select i.nombre, i.codigo, i.cantidad, c.nombre as en_carpeta
-- from public.trastero_items i
-- left join public.trastero_carpetas c on c.id = i.carpeta_id
-- order by i.id;
