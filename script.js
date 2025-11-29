// --- CONSTANTES ---
const btn = document.getElementById('btnGuardar');
const STORAGE_KEY = 'corte_data_v4_unico';

// --- UTILIDADES ---

/**
 * Redondea un número al .50 más cercano (0.00 o 0.50).
 * @param {number} num - Número a redondear.
 * @returns {number} Número redondeado.
 */
function roundTo50(num) { 
    // Multiplica por 2 (ej: 10.30 -> 20.60), redondea al entero más cercano (21), divide por 2 (10.50)
    return Math.round(num * 2) / 2; 
}

/**
 * Formatea un número como string de moneda.
 * @param {number} num - Número a formatear.
 * @returns {string} String formateado con $.
 */
function fmt(num) { 
    return '$' + num.toFixed(2); 
}

/**
 * Obtiene la fecha en formato simple "DD/MM/AAAA" para comparación.
 * @param {Date} dateObj - Objeto Date.
 * @returns {string} Fecha en formato local simple.
 */
function getSimpleDate(dateObj) {
    return dateObj.toLocaleDateString('es-MX');
}


// --- LÓGICA DE CÁLCULO Y GUARDADO ---

function calculateAndSave() {
    const amountInput = document.getElementById('amount');
    const amountVal = amountInput.value;
    
    if (!amountVal || isNaN(parseFloat(amountVal))) { 
        alert("⚠️ Escribe una cantidad válida primero."); 
        return; 
    }
    
    const amount = parseFloat(amountVal);
    
    // --- PASO 1: CALCULO MATEMATICO (55% Inv, 10% S1, 10% S2, 25% Deudas) ---
    let rawInv = amount * 0.55;
    let rawS1 = amount * 0.10;
    let rawS2 = amount * 0.10;
    
    // Redondear las partes principales a 0.00 o 0.50
    let inv = roundTo50(rawInv);
    let socio1 = roundTo50(rawS1);
    let socio2 = roundTo50(rawS2);
    
    // El resto va a Deudas (esto ajusta los centavos sobrantes/faltantes del redondeo)
    let debt = amount - inv - socio1 - socio2;
    debt = Math.round(debt * 100) / 100; // Limpiar posibles errores de punto flotante
    
    const breakdown = { inv, debt, socio1, socio2 };

    // --- PASO 2: MOSTRAR RESULTADOS EN PANTALLA (Preview) ---
    document.getElementById('resInv').textContent = fmt(inv);
    document.getElementById('resDebt').textContent = fmt(debt);
    document.getElementById('resP1').textContent = fmt(socio1);
    document.getElementById('resP2').textContent = fmt(socio2);
    document.getElementById('resTotal').textContent = fmt(amount);
    document.getElementById('resultCard').style.display = 'block';

    // --- PASO 3: GUARDADO INTELIGENTE (1 por día) ---
    try {
        const today = new Date();
        const todayStr = getSimpleDate(today);
        
        let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        // Buscar si ya existe un registro con la fecha de HOY
        const existingIndex = history.findIndex(item => getSimpleDate(new Date(item.date)) === todayStr);

        const newRecord = { 
            id: Date.now(), 
            date: today.toISOString(), 
            amount: amount, 
            breakdown: breakdown 
        };

        if (existingIndex !== -1) {
            // YA EXISTE: Preguntar confirmación
            if (confirm(`⚠️ Ya existe un corte del día ${todayStr} con valor de ${fmt(history[existingIndex].amount)}.\n\n¿Estás seguro que quieres SUSTITUIR la cuenta por esta nueva de ${fmt(amount)}?`)) {
                // Reemplazar el existente
                history[existingIndex] = newRecord;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                alert("✅ Corte actualizado correctamente.");
            } else {
                // Cancelar operación
                return; 
            }
        } else {
            // NO EXISTE: Guardar nuevo al principio
            history.unshift(newRecord);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        }

        // --- PASO 4: ACTUALIZAR VISTAS ---
        renderHistory();
        renderWeeklyTotal();
        amountInput.value = ''; // Limpiar el input

    } catch (e) {
        console.error("Error al guardar en localStorage:", e);
        alert("Error al guardar (posiblemente por el modo vista previa).");
    }
}

// --- RENDERS DE VISTA ---

/**
 * Renderiza la lista del historial de los últimos 7 días.
 */
function renderHistory() {
    try {
        const list = document.getElementById('historyList');
        // Obtener historial y ordenar por fecha más reciente (por si acaso)
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = '';
        
        // Mostrar solo ultimos 7 registros
        const recentHistory = history.slice(0, 7);

        recentHistory.forEach(item => {
            const d = new Date(item.date);
            // Formato 'Lun, 1' o 'Dom, 7'
            const fecha = d.toLocaleDateString('es-MX', {weekday:'short', day:'numeric'}).replace('.', ''); 
            
            list.innerHTML += `
            <div style="padding:10px 0; border-bottom:1px solid #eee;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:var(--primary); text-transform:capitalize;">${fecha}</span>
                    <span style="font-weight:bold; font-size:1.1em">${fmt(item.amount)}</span>
                </div>
            </div>`;
        });
        if(recentHistory.length === 0) list.innerHTML = '<div style="text-align:center; color:#999">Sin registros</div>';
    } catch(e) {
        console.error("Error al renderizar el historial:", e);
    }
}

/**
 * Calcula y muestra el total acumulado de la semana actual (de Lunes a Domingo).
 */
function renderWeeklyTotal() {
    try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const today = new Date();
        
        // Calcular el inicio de la semana (Lunes)
        const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const distToMonday = (dayOfWeek + 6) % 7; // Distancia en días a Lunes (si hoy es Lun(1), dist=0; si es Dom(0), dist=6)
        
        const monday = new Date(today);
        monday.setDate(today.getDate() - distToMonday);
        monday.setHours(0,0,0,0); // Establecer a medianoche

        let total = 0;
        history.forEach(item => {
            const itemDate = new Date(item.date);
            // Solo sumar si el registro es igual o posterior al Lunes
            if (itemDate >= monday) total += item.amount;
        });

        document.getElementById('weeklySum').textContent = fmt(total);
        
        // Calcular el final de la semana (Domingo)
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        // Mostrar el rango de fechas
        document.getElementById('weekRange').textContent = 
            `${monday.getDate()}/${monday.getMonth()+1} - ${sunday.getDate()}/${sunday.getMonth()+1}`;

    } catch(e) {
        console.error("Error al renderizar el total semanal:", e);
    }
}

// --- CONTROL DE DATOS ---

/**
 * Borra todos los datos del historial de localStorage.
 */
function clearData() {
    if(confirm('⚠️ ¿Estás seguro que deseas borrar TODO el historial de cortes guardados? Esta acción es irreversible.')) {
        localStorage.removeItem(STORAGE_KEY);
        renderHistory();
        renderWeeklyTotal();
        document.getElementById('resultCard').style.display = 'none';
        alert('✅ Historial borrado correctamente.');
    }
}


// --- INICIALIZACIÓN ---

// Añadir el listener al botón
btn.addEventListener('click', calculateAndSave);

// Asignar la función global para el botón de "Borrar todo"
window.clearData = clearData; 

// Iniciar al cargar la página
renderHistory();
renderWeeklyTotal();