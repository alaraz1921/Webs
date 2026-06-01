        const targetTimeDisplay = document.getElementById('targetTime');
        const hourHand = document.getElementById('hourHand');
        const minuteHand = document.getElementById('minuteHand');
        const checkButton = document.getElementById('checkButton');
        const resetButton = document.getElementById('resetButton');
        const confirmModal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        const winModal = document.getElementById('winModal');
        const feedbackModal = document.getElementById('feedbackModal');
        const feedbackTitle = document.getElementById('feedbackTitle');
        const feedbackMessage = document.getElementById('feedbackMessage');
        let targetHours = 0;
        let targetMinutes = 0;
        let userHours = 12;
        let userMinutes = 0;
        let score = 0;
        let confirmCallback = null;
        let lastTouchEnd = 0;

        document.addEventListener('touchend', (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        function updateClock() {
            // Calcular ángulos
            const minuteAngle = (userMinutes / 60) * 360;
            const hourAngle = ((userHours % 12) / 12) * 360 + (userMinutes / 60) * 30;
            
            // Aplicar rotación
            hourHand.style.transform = `translateX(-50%) rotate(${hourAngle}deg)`;
            minuteHand.style.transform = `translateX(-50%) rotate(${minuteAngle}deg)`;
        }

        function generateTargetTime() {
            targetHours = Math.floor(Math.random() * 12) + 1;
            targetMinutes = Math.floor(Math.random() * 12) * 5; // Múltiplos de 5
            const targetHourDisplay = targetHours % 12 === 0 ? 12 : targetHours % 12;
            const targetMinuteDisplay = targetMinutes < 10 ? `0${targetMinutes}` : targetMinutes;
            targetTimeDisplay.textContent = `Marca: ${targetHourDisplay}:${targetMinuteDisplay}`;
        }

        function checkTime() {
            const userHourDisplay = userHours % 12 === 0 ? 12 : userHours % 12;
            const userMinuteDisplay = userMinutes < 10 ? `0${userMinutes}` : userMinutes;
            if (userHours % 12 === targetHours % 12 && userMinutes === targetMinutes) {
                score++;
                if (score >= 8) {
                    winModal.style.display = 'flex';
                } else {
                    showFeedbackModal('¡Enhorabuena!', '¡Has marcado la hora correcta!');
                    setTimeout(() => {
                        generateTargetTime();
                        closeFeedbackModal();
                    }, 1000);
                }
            } else {
                showFeedbackModal('¡Intenta de nuevo!', `La hora de las manecillas es ${userHourDisplay}:${userMinuteDisplay}. Continúa ajustando.`);
            }
        }

        function showConfirmModal(message, callback) {
            modalTitle.textContent = message;
            confirmModal.style.display = 'flex';
            confirmCallback = callback;
        }

        function closeConfirmModal() {
            confirmModal.style.display = 'none';
            confirmCallback = null;
        }

        function showFeedbackModal(title, message) {
            feedbackTitle.textContent = title;
            feedbackMessage.textContent = message;
            feedbackModal.style.display = 'flex';
        }

        function closeFeedbackModal() {
            feedbackModal.style.display = 'none';
        }

        function resetGame() {
            showConfirmModal('¿Estás seguro de que quieres reiniciar el juego? Esto limpiará tu progreso.', () => {
                score = 0;
                userHours = 12;
                userMinutes = 0;
                generateTargetTime();
                updateClock();
                closeConfirmModal();
            });
        }

        document.getElementById('hourPlus').addEventListener('click', () => {
            userHours = (userHours + 1) % 24;
            updateClock();
        });

        document.getElementById('hourMinus').addEventListener('click', () => {
            userHours = (userHours - 1 + 24) % 24;
            updateClock();
        });

        document.getElementById('minutePlus').addEventListener('click', () => {
            userMinutes += 5;
            if (userMinutes >= 60) {
                userMinutes -= 60;
                userHours = (userHours + 1) % 24;
            }
            updateClock();
        });

        document.getElementById('minuteMinus').addEventListener('click', () => {
            userMinutes -= 5;
            if (userMinutes < 0) {
                userMinutes += 60;
                userHours = (userHours - 1 + 24) % 24;
            }
            updateClock();
        });

        document.getElementById('checkButton').addEventListener('click', checkTime);
        document.getElementById('resetButton').addEventListener('click', resetGame);
        document.getElementById('confirmYes').addEventListener('click', () => confirmCallback && confirmCallback());
        document.getElementById('confirmNo').addEventListener('click', closeConfirmModal);
        document.getElementById('winRestart').addEventListener('click', () => {
            resetGame();
            closeConfirmModal();
            winModal.style.display = 'none';
        });
        document.getElementById('feedbackClose').addEventListener('click', closeFeedbackModal);

        generateTargetTime();
        updateClock();
