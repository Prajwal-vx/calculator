document.addEventListener("DOMContentLoaded", () => {
    const currentDisplay = document.getElementById("current");
    const previousDisplay = document.getElementById("previous");
    const operatorBadge = document.getElementById("operatorBadge");
    const displayContainer = document.getElementById("displayContainer");
    const copiedToast = document.getElementById("copiedToast");
    const keypad = document.getElementById("keypad");
    const allButtons = document.querySelectorAll(".btn");

    // Header Controls
    const themeBtn = document.getElementById("themeBtn");
    const themeDropdown = document.getElementById("themeDropdown");
    const themeOptions = document.querySelectorAll(".theme-option");
    const soundBtn = document.getElementById("soundBtn");
    const soundOnIcon = soundBtn.querySelector(".sound-on-icon");
    const soundOffIcon = soundBtn.querySelector(".sound-off-icon");

    // History Panel
    const historyToggleBtn = document.getElementById("historyToggleBtn");
    const historyPanel = document.getElementById("historyPanel");
    const closeHistoryBtn = document.getElementById("closeHistoryBtn");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");
    const historyList = document.getElementById("historyList");
    const historyBadge = document.getElementById("historyBadge");

    // State
    let current = "0";
    let previous = "";
    let operator = null;
    let resetScreen = false;
    let isError = false;

    let soundEnabled = localStorage.getItem("neocalc_sound") !== "false";
    let savedTheme = localStorage.getItem("neocalc_theme") || "violet";
    let history = [];

    try {
        const storedHistory = localStorage.getItem("neocalc_history");
        if (storedHistory) history = JSON.parse(storedHistory);
    } catch (e) {
        history = [];
    }

    applyTheme(savedTheme);
    updateSoundIcon();
    renderHistory();
    updateDisplay();

    // Audio Synthesizer
    let audioCtx = null;
    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    }

    function playTone(type = "num") {
        if (!soundEnabled) return;
        try {
            initAudio();
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const now = audioCtx.currentTime;

            if (type === "num") {
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.04);
            } else if (type === "op") {
                osc.frequency.setValueAtTime(580, now);
                osc.frequency.exponentialRampToValueAtTime(720, now + 0.06);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.06);
            } else if (type === "equals") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.05);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.16);
            } else if (type === "delete" || type === "clear") {
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
                gain.gain.setValueAtTime(0.07, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.05);
            }
        } catch (e) {}
    }

    // Number Formatting & Display Scaling
    function formatNumberString(numStr) {
        if (!numStr || numStr === "Cannot divide by 0" || numStr === "Error" || numStr.includes("e")) return numStr;
        const parts = numStr.split(".");
        const formattedInteger = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.length > 1 ? `${formattedInteger}.${parts[1]}` : formattedInteger;
    }

    function adjustFontSize() {
        const textLength = currentDisplay.textContent.length;
        if (textLength > 16) currentDisplay.style.fontSize = "20px";
        else if (textLength > 13) currentDisplay.style.fontSize = "24px";
        else if (textLength > 10) currentDisplay.style.fontSize = "28px";
        else if (textLength > 8) currentDisplay.style.fontSize = "33px";
        else currentDisplay.style.fontSize = "40px";
    }

    function updateDisplay(animate = false) {
        if (isError) {
            currentDisplay.textContent = current;
            previousDisplay.textContent = "";
            operatorBadge.textContent = "";
            adjustFontSize();
            return;
        }

        currentDisplay.textContent = formatNumberString(current);
        if (previous && operator) {
            previousDisplay.textContent = `${formatNumberString(previous)} ${getOperatorSymbol(operator)}`;
            operatorBadge.textContent = getOperatorSymbol(operator);
        } else {
            previousDisplay.textContent = "";
            operatorBadge.textContent = "";
        }

        allButtons.forEach(btn => {
            if (btn.classList.contains("btn-operator")) {
                if (operator && btn.dataset.value === operator && current === "") {
                    btn.classList.add("active-op");
                } else {
                    btn.classList.remove("active-op");
                }
            }
        });

        adjustFontSize();

        if (animate) {
            currentDisplay.classList.remove("pop-animation");
            void currentDisplay.offsetWidth;
            currentDisplay.classList.add("pop-animation");
        }
    }

    function getOperatorSymbol(op) {
        const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷" };
        return symbols[op] || op;
    }

    function roundResult(val) {
        if (isNaN(val) || !isFinite(val)) return "Error";
        const rounded = Number(Math.round(val + "e+12") + "e-12");
        if (Math.abs(rounded) > 1e14 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
            return rounded.toExponential(6).replace(/\.?0+e/, "e");
        }
        return rounded.toString();
    }

    // Actions
    function appendNumber(num) {
        playTone("num");
        if (isError) clearCalculator(false);
        if (resetScreen) { current = ""; resetScreen = false; }

        if (num === ".") {
            if (current === "" || current === "0") {
                current = "0."; updateDisplay(); return;
            }
            if (current.includes(".")) return;
            current += "."; updateDisplay(); return;
        }

        if (current === "0") current = num;
        else {
            if (current.replace(/[^0-9]/g, "").length >= 16) return;
            current += num;
        }
        updateDisplay();
    }

    function chooseOperator(op) {
        playTone("op");
        if (isError) clearCalculator(false);
        if (current === "" && previous === "") {
            if (op === "-") { current = "-"; updateDisplay(); return; }
            return;
        }
        if (current === "" && previous !== "") {
            operator = op; updateDisplay(); return;
        }
        if (current === "-") return;
        if (previous !== "" && operator && current !== "") {
            calculate(false);
        }
        previous = current;
        current = "";
        operator = op;
        resetScreen = false;
        updateDisplay();
    }

    function calculate(showAnimation = true) {
        if (isError || previous === "" || current === "" || !operator || current === "-") return;
        const first = parseFloat(previous);
        const second = parseFloat(current);
        let result = 0;

        switch (operator) {
            case "+": result = first + second; break;
            case "-": result = first - second; break;
            case "*": result = first * second; break;
            case "/":
                if (second === 0) {
                    current = "Cannot divide by 0";
                    isError = true;
                    previous = "";
                    operator = null;
                    updateDisplay(true);
                    playTone("delete");
                    return;
                }
                result = first / second;
                break;
            default: return;
        }

        const formulaText = `${formatNumberString(previous)} ${getOperatorSymbol(operator)} ${formatNumberString(current)}`;
        const resultString = roundResult(result);

        if (showAnimation) {
            playTone("equals");
            addHistory(formulaText, resultString);
        }

        current = resultString;
        previous = "";
        operator = null;
        resetScreen = true;
        updateDisplay(showAnimation);
    }

    function clearCalculator(playSound = true) {
        if (playSound) playTone("clear");
        current = "0";
        previous = "";
        operator = null;
        resetScreen = false;
        isError = false;
        updateDisplay();
    }

    function deleteNumber() {
        playTone("delete");
        if (isError || resetScreen) { clearCalculator(false); return; }
        if (current === "0" || current === "") return;
        current = current.slice(0, -1);
        if (current === "" || current === "-") current = "0";
        updateDisplay();
    }

    function negateNumber() {
        playTone("op");
        if (isError || current === "0" || current === "") return;
        current = current.startsWith("-") ? current.slice(1) : "-" + current;
        updateDisplay();
    }

    function percentage() {
        playTone("op");
        if (isError || current === "" || current === "0") return;
        const currVal = parseFloat(current);
        if (previous !== "" && (operator === "+" || operator === "-")) {
            const prevVal = parseFloat(previous);
            current = roundResult(prevVal * (currVal / 100));
        } else {
            current = roundResult(currVal / 100);
        }
        updateDisplay();
    }

    // History
    function addHistory(formula, result) {
        history.unshift({ formula, result, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        if (history.length > 30) history.pop();
        try { localStorage.setItem("neocalc_history", JSON.stringify(history)); } catch (e) {}
        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            historyList.innerHTML = `<div class="history-empty"><p>No calculations yet</p><span>Calculations will appear here</span></div>`;
            historyBadge.classList.add("hidden");
            return;
        }
        historyBadge.classList.remove("hidden");
        historyBadge.textContent = history.length;
        historyList.innerHTML = history.map((item, idx) => `
            <div class="history-item" data-history-idx="${idx}" title="Click to recall this result">
                <div class="history-item-formula">${item.formula} =</div>
                <div class="history-item-result">${formatNumberString(item.result)}</div>
            </div>
        `).join("");

        document.querySelectorAll(".history-item").forEach(el => {
            el.addEventListener("click", () => {
                const idx = parseInt(el.dataset.historyIdx, 10);
                if (history[idx]) {
                    playTone("num");
                    current = history[idx].result;
                    resetScreen = true;
                    isError = false;
                    updateDisplay(true);
                    closeHistory();
                }
            });
        });
    }

    function openHistory() { historyPanel.classList.add("open"); historyPanel.setAttribute("aria-hidden", "false"); }
    function closeHistory() { historyPanel.classList.remove("open"); historyPanel.setAttribute("aria-hidden", "true"); }

    historyToggleBtn.addEventListener("click", () => historyPanel.classList.contains("open") ? closeHistory() : openHistory());
    closeHistoryBtn.addEventListener("click", closeHistory);
    clearHistoryBtn.addEventListener("click", () => {
        history = [];
        try { localStorage.removeItem("neocalc_history"); } catch (e) {}
        renderHistory();
        playTone("clear");
    });

    // Theme Switcher
    function applyTheme(themeName) {
        document.documentElement.setAttribute("data-theme", themeName);
        savedTheme = themeName;
        try { localStorage.setItem("neocalc_theme", themeName); } catch (e) {}
        themeOptions.forEach(opt => opt.classList.toggle("active", opt.dataset.setTheme === themeName));
    }

    themeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle("open");
        themeBtn.setAttribute("aria-expanded", themeDropdown.classList.contains("open").toString());
    });

    themeOptions.forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            applyTheme(opt.dataset.setTheme);
            themeDropdown.classList.remove("open");
            themeBtn.setAttribute("aria-expanded", "false");
            playTone("op");
        });
    });

    document.addEventListener("click", (e) => {
        if (!themeBtn.contains(e.target) && !themeDropdown.contains(e.target)) {
            themeDropdown.classList.remove("open");
            themeBtn.setAttribute("aria-expanded", "false");
        }
    });

    // Sound Toggle
    function updateSoundIcon() {
        soundOnIcon.classList.toggle("hidden", !soundEnabled);
        soundOffIcon.classList.toggle("hidden", soundEnabled);
        soundBtn.title = soundEnabled ? "Mute Sound Effects" : "Unmute Sound Effects";
    }

    soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        try { localStorage.setItem("neocalc_sound", soundEnabled.toString()); } catch (e) {}
        updateSoundIcon();
        if (soundEnabled) playTone("op");
    });

    // Click to copy
    displayContainer.addEventListener("click", async () => {
        if (current === "" || current === "Cannot divide by 0" || current === "Error") return;
        try {
            await navigator.clipboard.writeText(current);
        } catch (err) {
            const temp = document.createElement("input");
            temp.value = current; document.body.appendChild(temp); temp.select();
            document.execCommand("copy"); document.body.removeChild(temp);
        }
        copiedToast.classList.add("show");
        playTone("num");
        setTimeout(() => copiedToast.classList.remove("show"), 1800);
    });

    // Button clicks
    keypad.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn");
        if (!btn) return;
        const value = btn.dataset.value;
        const action = btn.dataset.action;

        if (value !== undefined) {
            if ("0123456789.".includes(value)) appendNumber(value);
            else if ("+-*/".includes(value)) chooseOperator(value);
            return;
        }

        switch (action) {
            case "clear": clearCalculator(); break;
            case "delete": deleteNumber(); break;
            case "negate": negateNumber(); break;
            case "percent": percentage(); break;
            case "calculate": calculate(); break;
        }
    });

    // Keyboard support with button animations
    function triggerButtonAnimation(keyQuery) {
        const btn = document.querySelector(`.btn[data-key="${keyQuery}"]`) || document.querySelector(`.btn[data-value="${keyQuery}"]`);
        if (btn) {
            btn.classList.add("btn-active");
            setTimeout(() => btn.classList.remove("btn-active"), 120);
        }
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (themeDropdown.classList.contains("open")) { themeDropdown.classList.remove("open"); return; }
            if (historyPanel.classList.contains("open")) { closeHistory(); return; }
        }

        const key = event.key;
        if ((key >= "0" && key <= "9") || key === ".") {
            event.preventDefault(); triggerButtonAnimation(key); appendNumber(key); return;
        }
        if (key === "+" || key === "-" || key === "*" || key === "/") {
            event.preventDefault(); triggerButtonAnimation(key); chooseOperator(key); return;
        }
        if (key === "x" || key === "X") {
            event.preventDefault(); triggerButtonAnimation("*"); chooseOperator("*"); return;
        }
        if (key === "Enter" || key === "=") {
            event.preventDefault(); triggerButtonAnimation("Enter"); calculate(); return;
        }
        if (key === "Backspace") {
            event.preventDefault(); triggerButtonAnimation("Backspace"); deleteNumber(); return;
        }
        if (key === "Escape" || key === "Delete" || key === "c" || key === "C") {
            event.preventDefault(); triggerButtonAnimation("Escape"); clearCalculator(); return;
        }
        if (key === "%") {
            event.preventDefault(); triggerButtonAnimation("%"); percentage(); return;
        }
        if (key === "n" || key === "N" || key === "_") {
            event.preventDefault(); triggerButtonAnimation("n"); negateNumber(); return;
        }
    });
});