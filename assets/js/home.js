        // LÓGICA DEL MENÚ HAMBURGUESA EN MÓVILES
        const menuBtn = document.getElementById('mobile-menu-btn');
        const menuList = document.getElementById('nav-menu-list');

        menuBtn.addEventListener('click', () => {
            menuBtn.classList.toggle('open');
            menuList.classList.toggle('mobile-open');
        });

        // CONTROL DEL DESPLEGABLE "OTROS" (FUNCIONA CON CLIC EN ESCRITORIO Y MÓVIL)
        const dropdownTrigger = document.getElementById('dropdown-trigger');
        const customSubmenu = document.getElementById('custom-submenu');
        const parentItem = dropdownTrigger.parentElement;

        dropdownTrigger.addEventListener('click', (e) => {
            e.preventDefault(); // Evita que la página salte al inicio al pulsar '#'
            e.stopPropagation(); // Evita que el evento 'click' se propague al documento
            
            if (window.innerWidth > 768) {
                // Modo Escritorio: Activa/Desactiva el desplegable flotante
                customSubmenu.classList.toggle('desktop-open');
            } else {
                // Modo Móvil: Activa/Desactiva el menú colapsable vertical
                customSubmenu.classList.toggle('open');
            }
            parentItem.classList.toggle('active');
        });

        // DETECTAR CLICS FUERA DEL MENÚ PARA CERRARLO AUTOMÁTICAMENTE
        document.addEventListener('click', (e) => {
            // Si hacemos clic fuera del botón "Games" y de su menú desplegable, lo cerramos
            if (!parentItem.contains(e.target)) {
                customSubmenu.classList.remove('desktop-open');
                customSubmenu.classList.remove('open');
                parentItem.classList.remove('active');
            }
        });

        // LÓGICA PARA CONTROLAR EL MODAL EMERGENTE (BOTÓN DE ABAJO)
        const modal = document.getElementById('otros-modal');
        const mensajeModal = document.getElementById('mensaje-modal');

        function abrirModal() {
            modal.style.display = 'flex';
        }

        function cerrarModal() {
            modal.style.display = 'none';
        }

        function enviarContacto(event) {
            event.preventDefault();
            event.target.reset();
            mensajeModal.style.display = 'flex';
        }

        function cerrarMensajeModal() {
            mensajeModal.style.display = 'none';
        }

        // Cerrar el modal si se pulsa sobre la capa oscura del fondo
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cerrarModal();
            }
        });

        mensajeModal.addEventListener('click', (e) => {
            if (e.target === mensajeModal) {
                cerrarMensajeModal();
            }
        });

        // CAMBIAR COLOR DEL NAVBAR AL HACER SCROLL (SÓLO ESCRITORIO)
        const navbar = document.getElementById('main-navbar');
        
        window.addEventListener('scroll', () => {
            if (window.innerWidth > 768) {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }
        });
