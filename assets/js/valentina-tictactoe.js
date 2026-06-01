        const gameGrid = document.getElementById('gameGrid');
        const confirmModal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        let currentPlayer = 'x';
        let confirmCallback = null;

        function showConfirmModal(message, callback) {
            modalTitle.textContent = message;
            confirmModal.style.display = 'flex';
            confirmCallback = callback;
        }

        function closeConfirmModal() {
            confirmModal.style.display = 'none';
            confirmCallback = null;
        }

        function createGrid() {
            gameGrid.innerHTML = '';
            for (let i = 0; i < 9; i++) {
                const cell = document.createElement('div');
                cell.classList.add('game-cell', 'w-20', 'h-20', 'bg-white', 'border-2', 'border-gray-800', 'rounded-lg', 'flex', 'items-center', 'justify-center', 'text-4xl', 'font-bold', 'text-gray-800');
                cell.addEventListener('click', () => handleCellClick(cell));
                gameGrid.appendChild(cell);
            }
        }

        function handleCellClick(cell) {
            if (!cell.textContent) {
                cell.textContent = currentPlayer.toUpperCase();
                cell.classList.add(currentPlayer, currentPlayer === 'x' ? 'text-red-600' : 'text-blue-600');
                currentPlayer = currentPlayer === 'x' ? 'o' : 'x';
            }
        }

        function newGame() {
            showConfirmModal('¿Estás seguro de que quieres iniciar un nuevo juego? Esto limpiará todas las casillas.', () => {
                createGrid();
                currentPlayer = 'x';
                closeConfirmModal();
            });
        }

        document.getElementById('newGameButton').addEventListener('click', newGame);
        document.getElementById('confirmYes').addEventListener('click', () => confirmCallback && confirmCallback());
        document.getElementById('confirmNo').addEventListener('click', closeConfirmModal);

        createGrid();
