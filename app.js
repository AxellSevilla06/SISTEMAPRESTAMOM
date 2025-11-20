// -----------------------------------------------------------------
// ¡CAMBIO IMPORTANTE!
// Ya NO usamos 'import'. Usamos el 'supabase' que se cargó en el index.html
// -----------------------------------------------------------------
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// -----------------------------------------------------------------
// ¡LISTO! Tus credenciales de Supabase ya están configuradas.
// -----------------------------------------------------------------
const SUPABASE_URL = 'https://kscmbggubxgkaroojxoa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY21iZ2d1Ynhna2Fyb29qeG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMjYwMzMsImV4cCI6MjA3ODcwMjAzM30.w1xq1N8ba0m99I0vEMAfSC2sgmdQYN53qW4-DJRyJb0';
// -----------------------------------------------------------------

let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("Supabase URL/Key no configurada.");
    }
    
    // ¡CAMBIO IMPORTANTE! Así tomamos la función de Supabase
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

} catch (error) {
    console.warn(error.message);
    document.addEventListener('DOMContentLoaded', () => {
        const appView = document.getElementById('app-view');
        if(appView) {
            appView.innerHTML = `
                <div class="max-w-md mx-auto mt-10 p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-lg">
                    <h2 class="text-2xl font-bold mb-4">Error de Conexión</h2>
                    <p>Hubo un problema al inicializar Supabase. Revisa la consola para más detalles.</p>
                </div>
            `;
            document.getElementById('auth-view').classList.add('hidden');
        }
    });
}
        
// --- Selectores de UI (Globales) ---
let loginForm, registerForm, authView, appView, loadingIndicator;
let adminDashboard, collectorDashboard, userEmailDisplay, logoutButton;
let notificationBox, adminTabs;

// --- Selectores Módulo Clientes ---
let clientsTableBody, clientModal, clientForm, closeClientModalBtn, clientModalTitle, routeSelect, clientIdInput;
let openClientModalBtn, cancelClientModalBtn;

// --- Selectores Módulo Préstamos ---
let loansTableBody, loanModal, loanForm, closeLoanModalBtn, loanModalTitle, loanClientIdSelect;
let openLoanModalBtn, cancelLoanModalBtn, loanCalcResults, loanIdInput;

// --- Selectores Módulo Pagos ---
let paymentModal, paymentForm, closePaymentModalBtn, paymentModalTitle, paymentLoanIdInput;
let loanDetailClient, loanDetailAmount, loanDetailTotal, loanDetailStatus;
let paymentScheduleBody, paymentHistoryBody, paymentDateField;

// --- Selectores Módulo Usuarios y Rutas ---
let routesTableBody, routeModal, routeForm, closeRouteModalBtn, routeModalTitle, routeIdInput;
let openRouteModalBtn, cancelRouteModalBtn;
let usersTableBody, userModal, userForm, closeUserModalBtn, cancelUserModalBtn, userModalTitle, userIdInput;
let userFullNameDisplay, userEmailDisplayEl, userRoleSelect, userRouteSelect;

// --- (NUEVO) Selectores Módulo Reportes ---
let kpiTotalLoaned, kpiTotalCollected, kpiInterestEarned, kpiActiveLoans;
let reportsStatusTableBody;
// --- (NUEVO) Selectores de Búsqueda ---
let clientSearchInput; // Campo de búsqueda en tabla de clientes
let loanClientSearchInput; // Campo de búsqueda en modal de préstamo

// --- Selectores Módulo Confirmación ---
let confirmationModal, confirmText, confirmButton, cancelConfirmButton;
let confirmCallback = null;

// --- Estado de la Aplicación ---
let currentUser = null;
let userRole = null;

// (Debe estar cerca del inicio de tu app.js, después de let userRole = null;)
function handleDeletePayment(paymentId, loanId) {
    openConfirmationModal(`¿Estás seguro de que quieres borrar este abono? El sistema recalculará el saldo del préstamo.`, async () => {
        showLoading(true);

        // Llama al RPC (la función SQL que creamos en el Paso 3)
        const { error } = await supabase.rpc('delete_payment_and_recalculate', {
            p_payment_id: paymentId,
            p_loan_id: loanId
        });

        showLoading(false);

        if (error) {
            showNotification('Error al borrar el abono: ' + error.message, true);
            console.error('Error RPC delete_payment:', error);
        } else {
            showNotification('Abono borrado. El préstamo ha sido recalculado.', false);
            handleViewLoan(loanId);
            loadLoans();
            loadAdminDashboard();
        }
    });
}

// --- Funciones de Utilidad ---
function showNotification(message, isError = false) {
    if (!notificationBox) return;
    notificationBox.textContent = message;
    notificationBox.classList.remove('hidden', 'bg-red-500', 'bg-green-500', 'bg-blue-500');
    
    if (isError) {
        notificationBox.classList.add('bg-red-500');
    } else {
        notificationBox.classList.add('bg-green-500');
    }
    
    setTimeout(() => {
        notificationBox.classList.add('hidden');
    }, 3000);
}

function showLoading(isLoading) {
    if (loadingIndicator) {
        loadingIndicator.classList.toggle('hidden', !isLoading);
    }
}

function openConfirmationModal(message, onConfirm) {
    if (!confirmationModal || !confirmText) return;
    confirmText.textContent = message;
    confirmCallback = onConfirm;
    confirmationModal.classList.remove('hidden');
}

function closeConfirmationModal() {
    if (!confirmationModal) return;
    confirmationModal.classList.add('hidden');
    confirmCallback = null;
}

function handleConfirm() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmationModal();
}

function formatCurrency(value) {
    // Corregido para Córdoba Nicaragüense (NIO)
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTodayForInput() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Ajustar a la zona horaria local
    return now.toISOString().slice(0, 10); // Formato YYYY-MM-DD
}

function getNowForDateTimeInput() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16); // Formato YYYY-MM-DDTHH:mm
}

// --- Funciones de Autenticación ---
async function handleRegister(e) {
    e.preventDefault();
    const email = registerForm.email.value;
    const password = registerForm.password.value;
    const role = registerForm.role.value;
    const fullName = registerForm.full_name.value;

    showLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                role: role,
                full_name: fullName
            }
        }
    });
    showLoading(false);

    if (error) {
        showNotification(`Error al registrar: ${error.message}`, true);
        console.error('Error de registro:', error);
    } else {
        showNotification('Registro exitoso. Revisa tu email para confirmar.', false);
        registerForm.reset();
        if (window.Alpine) {
            Alpine.data(document.querySelector('[x-data]')).tab = 'login';
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;

    showLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    showLoading(false);

    if (error) {
        showNotification(`Error al iniciar sesión: ${error.message}`, true);
        console.error('Error de login:', error);
    } else {
        showNotification('Inicio de sesión exitoso.', false);
    }
}

async function handleLogout() {
    showLoading(true);
    const { error } = await supabase.auth.signOut();
    showLoading(false);
    if (error) {
        showNotification(`Error al cerrar sesión: ${error.message}`, true);
    } else {
        showNotification('Sesión cerrada.', false);
    }
}

// --- Control de Vistas ---
function updateUIBasedOnAuth(session) {
    if (session && session.user) {
        currentUser = session.user;
        userRole = currentUser.user_metadata.role;

        authView.classList.add('hidden');
        appView.classList.remove('hidden');

        userEmailDisplay.textContent = `Usuario: ${currentUser.email} (Rol: ${userRole})`;

        if (userRole === 'admin') {
            adminDashboard.classList.remove('hidden');
            collectorDashboard.classList.add('hidden');
            // (NUEVO) Cargar el dashboard de admin por defecto
            loadAdminDashboard();
        } else if (userRole === 'cobrador') {
            adminDashboard.classList.add('hidden');
            collectorDashboard.classList.remove('hidden');
            // Aquí cargaríamos datos para el cobrador (ej: loadMyRoute())
        } else {
            adminDashboard.classList.add('hidden');
            collectorDashboard.classList.add('hidden');
            showNotification('Rol de usuario no reconocido.', true);
        }

    } else {
        currentUser = null;
        userRole = null;
        authView.classList.remove('hidden');
        appView.classList.add('hidden');
    }
}
// ===================================================
// MÓDULO 1.1: GESTIÓN DE CLIENTES (Admin)
// ===================================================

// Cargar Rutas (para el <select>)
async function loadRoutes() {
    if (userRole !== 'admin' || !routeSelect) return;

    const { data, error } = await supabase
        .from('routes')
        .select('id, name');

    if (error) {
        showNotification('Error al cargar las rutas: ' + error.message, true);
        console.error('Error cargando rutas:', error);
        return;
    }

    routeSelect.innerHTML = '<option value="">Sin asignar</option>'; // Opción por defecto
    data.forEach(route => {
        const option = document.createElement('option');
        option.value = route.id;
        option.textContent = route.name;
        routeSelect.appendChild(option);
    });
}

// Cargar Clientes (para la tabla)
async function loadClients() {
    if (userRole !== 'admin' || !clientsTableBody) return;
    showLoading(true);
    
    // (NUEVO) Obtener el término de búsqueda
    const searchTerm = clientSearchInput ? clientSearchInput.value.trim() : '';
    
    let query = supabase
        .from('clients')
        .select(`
            id,
            first_name,
            last_name,
            phone,
            status,
            route_id,
            routes ( name ) 
        `);

    // (NUEVO) Lógica de búsqueda avanzada
    if (searchTerm) {
        // 'ilike' es 'insensitive case' (ignora mayúsculas/minúsculas)
        // 'or' busca en cualquiera de estas columnas
        query = query.or(
            `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,personal_id_number.ilike.%${searchTerm}%`
        );
    }
    
    const { data, error } = await query
        .order('created_at', { ascending: false });

    showLoading(false);

    if (error) {
        showNotification('Error al cargar clientes: ' + error.message, true);
        console.error('Error cargando clientes:', error);
        return;
    }
    renderClientsTable(data);
}

// Renderizar tabla de clientes
function renderClientsTable(clients) {
    if (!clientsTableBody) return;
    clientsTableBody.innerHTML = '';
    if (clients.length === 0) {
        clientsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-gray-500 py-4">No hay clientes registrados.</td>
            </tr>
        `;
        return;
    }

    clients.forEach(client => {
        const routeName = client.routes ? client.routes.name : 'N/A';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
            <td class="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${client.first_name} ${client.last_name}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${client.phone || 'N/A'}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${client.status === 'activo' ? 'bg-green-100 text-green-800' : 
                       client.status === 'moroso' ? 'bg-red-100 text-red-800' : 
                       client.status === 'vetado' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-800'}">
                    ${client.status}
                </span>
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${routeName}</td>
            <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-client-id="${client.id}" class="text-indigo-600 hover:text-indigo-900 edit-client-btn">Editar</button>
                <button data-client-id="${client.id}" data-client-name="${client.first_name} ${client.last_name}" class="text-red-600 hover:text-red-900 ml-4 delete-client-btn">Borrar</button>
            </td>
        `;
        clientsTableBody.appendChild(tr);
    });

    // Asignar eventos a los botones
    document.querySelectorAll('.edit-client-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const clientId = e.target.dataset.clientId;
            const { data: clientData, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
            if (error) {
                showNotification('Error al cargar datos del cliente: ' + error.message, true);
            } else {
                openClientModal(clientData);
            }
        });
    });

    document.querySelectorAll('.delete-client-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const clientId = e.target.dataset.clientId;
            const clientName = e.target.dataset.clientName;
            handleDeleteClient(clientId, clientName);
        });
    });
}

// Abrir modal de cliente
function openClientModal(client = null) {
    clientForm.reset();
    loadRoutes(); // Cargar rutas en el select
    if (client) {
        clientModalTitle.textContent = 'Editar Cliente';
        clientIdInput.value = client.id;
        clientForm.first_name.value = client.first_name;
        clientForm.last_name.value = client.last_name;
        clientForm.phone.value = client.phone;
        clientForm.address.value = client.address;
        clientForm.email.value = client.email;
        clientForm.personal_id_number.value = client.personal_id_number;
        clientForm.status.value = client.status;
        clientForm.route_id.value = client.route_id || '';
        clientForm.references.value = client.references ? JSON.stringify(client.references, null, 2) : '';

    } else {
        clientModalTitle.textContent = 'Nuevo Cliente';
        clientIdInput.value = '';
    }
    clientModal.classList.remove('hidden');
}

function closeClientModal() {
    clientModal.classList.add('hidden');
    clientForm.reset();
}

// Guardar (Crear o Editar) Cliente
async function handleClientSubmit(e) {
    e.preventDefault();
    const formData = new FormData(clientForm);
    const clientId = clientIdInput.value;

    let referencesJson = null;
    try {
        if (formData.get('references').trim()) {
            referencesJson = JSON.parse(formData.get('references'));
        }
    } catch (error) {
        showNotification('El campo "Referencias" no es un JSON válido.', true);
        return;
    }

    const clientData = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        phone: formData.get('phone') || null,
        address: formData.get('address') || null,
        email: formData.get('email') || null,
        personal_id_number: formData.get('personal_id_number') || null,
        status: formData.get('status'),
        route_id: formData.get('route_id') || null,
        "references": referencesJson
    };

    if (!clientId) {
        clientData.created_by = currentUser.id;
    }

    showLoading(true);
    let error;
    if (clientId) {
        const { error: updateError } = await supabase.from('clients').update(clientData).eq('id', clientId);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('clients').insert([clientData]);
        error = insertError;
    }
    showLoading(false);

    if (error) {
        showNotification('Error al guardar cliente: ' + error.message, true);
        console.error('Error guardando cliente:', error);
    } else {
        showNotification(`Cliente ${clientId ? 'actualizado' : 'creado'} con éxito.`, false);
        closeClientModal();
        loadClients();
    }
}

// Borrar Cliente
function handleDeleteClient(clientId, clientName) {
    openConfirmationModal(`¿Estás seguro de que quieres borrar al cliente "${clientName}"? Esta acción no se puede deshacer.`, async () => {
        showLoading(true);
        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        showLoading(false);

        if (error) {
            showNotification('Error al borrar cliente: ' + error.message, true);
            console.error('Error borrando cliente:', error);
        } else {
            showNotification('Cliente borrado con éxito.', false);
            loadClients();
        }
    });
}
// ===================================================
// MÓDULO 1.2: GESTIÓN DE PRÉSTAMOS
// ===================================================

// Cargar Clientes (para el <select> del modal de préstamos)
// Cargar Clientes (para el <select> del modal de préstamos)
async function loadClientsForDropdown(searchTerm = '') { // (NUEVO) Acepta un término de búsqueda
    if (userRole !== 'admin' || !loanClientIdSelect) return;

    let query = supabase
        .from('clients')
        .select('id, first_name, last_name')
        .eq('status', 'activo') // Solo clientes activos
        .order('first_name', { ascending: true });

    // (NUEVO) Lógica de búsqueda en el dropdown
    if (searchTerm) {
        query = query.or(
            `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,personal_id_number.ilike.%${searchTerm}%`
        );
    } else {
        // Si no hay búsqueda, solo cargamos los primeros 50 para evitar sobrecarga
        query = query.limit(50);
    }

    const { data, error } = await query;

    if (error) {
        showNotification('Error al cargar clientes: ' + error.message, true);
        return;
    }

    loanClientIdSelect.innerHTML = '<option value="">Seleccione un cliente</option>';
    data.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = `${client.first_name} ${client.last_name}`;
        loanClientIdSelect.appendChild(option);
    });
}

// Cargar Préstamos (para la tabla principal)
// Cargar Préstamos (para la tabla principal)
async function loadLoans() {
    if (userRole !== 'admin' || !loansTableBody) return;
    showLoading(true);
    
    // (NUEVO) Lógica de búsqueda principal
    const searchTerm = clientSearchInput ? clientSearchInput.value.trim() : '';
    
    let query = supabase
        .from('loans')
        .select(`
            id,
            client_id,
            amount,
            total_to_pay,
            total_interest,  // << NECESARIO PARA AMORTIZACIÓN Y REPORTE
            total_payments,
            term_type,
            status,
            clients ( first_name, last_name, phone, personal_id_number ) // Añadido campos para búsqueda
        `);

    // (NUEVO) Aplicar filtro de búsqueda al JOIN
    if (searchTerm) {
        query = query.or(
            `clients.first_name.ilike.%${searchTerm}%,clients.last_name.ilike.%${searchTerm}%,clients.phone.ilike.%${searchTerm}%,clients.personal_id_number.ilike.%${searchTerm}%`
        );
    }

    const { data, error } = await query
        .order('created_at', { ascending: false });

    showLoading(false);

    if (error) {
        showNotification('Error al cargar préstamos: ' + error.message, true);
        console.error('Error cargando préstamos:', error);
        return;
    }
    renderLoansTable(data);
}

// Renderizar tabla de préstamos
function renderLoansTable(loans) {
    if (!loansTableBody) return;
    loansTableBody.innerHTML = '';
    if (loans.length === 0) {
        loansTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-gray-500 py-4">No hay préstamos registrados.</td>
            </tr>
        `;
        return;
    }

    loans.forEach(loan => {
        const clientName = loan.clients ? `${loan.clients.first_name} ${loan.clients.last_name}` : 'Cliente Borrado';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        // CORRECCIÓN: Botón de Borrar añadido al innerHTML
        tr.innerHTML = `
            <td class="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${clientName}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${formatCurrency(loan.amount)}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${formatCurrency(loan.total_to_pay)}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${loan.total_payments} ${loan.term_type}s</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${loan.status === 'activo' ? 'bg-blue-100 text-blue-800' : 
                       loan.status === 'moroso' ? 'bg-red-100 text-red-800' : 
                       'bg-green-100 text-green-800'}">
                    ${loan.status}
                </span>
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-loan-id="${loan.id}" class="text-green-600 hover:text-green-900 view-loan-btn">Ver/Pagar</button>
                <button data-loan-id="${loan.id}" data-client-name="${clientName}" class="text-red-600 hover:text-red-900 ml-4 delete-loan-btn">Borrar</button>
            </td>
        `;
        loansTableBody.appendChild(tr);
    });

    // Asignar eventos a los botones
    document.querySelectorAll('.view-loan-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const loanId = e.target.dataset.loanId;
            handleViewLoan(loanId);
        });
    });

    // CORRECCIÓN: Evento para el nuevo botón de borrar
    document.querySelectorAll('.delete-loan-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const loanId = e.target.dataset.loanId;
            const clientName = e.target.dataset.clientName;
            handleDeleteLoan(loanId, clientName);
        });
    });
}
// Abrir modal de préstamo
function openLoanModal(loan = null) {
    loanForm.reset();
    loadClientsForDropdown(); // Cargar clientes activos en el select
    
    // Poner fechas por defecto
    const today = getTodayForInput();
    loanForm.issue_date.value = today;
    
    // Calcular fecha de primer pago (ej: 7 días después)
    // Se asume que la zona horaria es la local
    const issueDate = new Date(); 
    issueDate.setDate(issueDate.getDate() + 7);
    loanForm.first_payment_date.value = issueDate.toISOString().slice(0, 10);


    if (loan) {
        // Lógica para editar (a implementar)
        loanModalTitle.textContent = 'Editar Préstamo';
        loanIdInput.value = loan.id;
        // ... rellenar campos
    } else {
        loanModalTitle.textContent = 'Nuevo Préstamo';
        loanIdInput.value = '';
    }
    loanModal.classList.remove('hidden');
    calculateLoanTotals(); // Calcular con campos vacíos (mostrará 0)
}

function closeLoanModal() {
    loanModal.classList.add('hidden');
    loanForm.reset();
}

// Calcular totales del préstamo (en el modal)
function calculateLoanTotals() {
    if (!loanForm) return;
    const amount = parseFloat(loanForm.amount.value) || 0;
    const interestRate = parseFloat(loanForm.interest_rate.value) || 0;
    const totalPayments = parseInt(loanForm.total_payments.value) || 0;
    // const termType = loanForm.term_type.value;

    if (amount > 0 && interestRate > 0 && totalPayments > 0) {
        // Interés simple total (Tasa * Número de Pagos)
        const totalInterest = amount * (interestRate / 100) * totalPayments;
        const totalToPay = amount + totalInterest;
        const paymentAmount = totalToPay / totalPayments;

        loanCalcResults.innerHTML = `
            <div class="flex justify-between"><span>Interés Total:</span> <span class="font-medium">${formatCurrency(totalInterest)}</span></div>
            <div class="flex justify-between"><span>Total a Pagar:</span> <span class="font-medium text-blue-600">${formatCurrency(totalToPay)}</span></div>
            <hr class="my-2">
            <div class="flex justify-between text-lg"><span>Monto por Cuota:</span> <span class="font-bold text-green-600">${formatCurrency(paymentAmount)}</span></div>
        `;
    } else {
        loanCalcResults.innerHTML = `
            <div class="flex justify-between"><span>Interés Total:</span> <span class="font-medium">${formatCurrency(0)}</span></div>
            <div class="flex justify-between"><span>Total a Pagar:</span> <span class="font-medium text-blue-600">${formatCurrency(0)}</span></div>
            <hr class="my-2">
            <div class="flex justify-between text-lg"><span>Monto por Cuota:</span> <span class="font-bold text-green-600">${formatCurrency(0)}</span></div>
        `;
    }
}

// Guardar (Crear) Préstamo
async function handleLoanSubmit(e) {
    e.preventDefault();
    const formData = new FormData(loanForm);
    const loanId = loanIdInput.value;

    if (loanId) {
        showNotification('La edición de préstamos aún no está implementada.', true);
        return;
    }

    // Recalcular valores para asegurar consistencia
    const amount = parseFloat(formData.get('amount')) || 0;
    const interestRate = parseFloat(formData.get('interest_rate')) || 0;
    const totalPayments = parseInt(formData.get('total_payments')) || 0;
    
    // Datos para la función RPC
    const loanData = {
        p_client_id: formData.get('client_id'),
        p_amount: amount,
        p_interest_rate: interestRate / 100, // IMPORTANTE: Convertir a decimal
        p_total_payments: totalPayments,
        p_term_type: formData.get('term_type'),
        p_issue_date: formData.get('issue_date'),
        p_first_payment_date: formData.get('first_payment_date'),
        p_collection_method: formData.get('collection_method'),
        
        // Lo buscaremos a continuación
        p_route_id: null, 
        p_cobrador_id: null, 
    };
    
    // Validar datos básicos
    if (!loanData.p_client_id || !loanData.p_amount > 0 || !loanData.p_interest_rate > 0 || !loanData.p_total_payments > 0) {
        showNotification('Formulario incompleto. Revise los campos.', true);
        return;
    }
    
    showLoading(true);

    // ANTES de llamar al RPC, necesitamos la ruta y el cobrador de ese cliente
    try {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('route_id')
            .eq('id', loanData.p_client_id)
            .single();
        
        if (clientError) throw clientError;
        
        loanData.p_route_id = clientData.route_id;

        if(clientData.route_id) {
            const { data: cobradorData } = await supabase
                .from('profiles')
                .select('id')
                .eq('route_id', clientData.route_id)
                .eq('role', 'cobrador')
                .limit(1) 
                .single();
            
            if (cobradorData) {
                loanData.p_cobrador_id = cobradorData.id;
            }
        }

    } catch (error) {
        console.warn('No se pudo asignar cobrador automáticamente:', error.message);
    }


    // Llama al NUEVO RPC de amortización (Este es el que DEBE ejecutarse)
    const { data, error } = await supabase.rpc('create_amortization_schedule', {
        p_client_id: loanData.p_client_id,
        p_amount: amount,
        p_interest_rate: loanData.p_interest_rate,
        p_total_payments: totalPayments,
        p_term_type: loanData.p_term_type,
        p_issue_date: loanData.p_issue_date,
        p_first_payment_date: loanData.p_first_payment_date,
        p_collection_method: loanData.p_collection_method,
        p_route_id: loanData.p_route_id,
        p_cobrador_id: loanData.p_cobrador_id
    });

    showLoading(false);

    if (error) {
        showNotification('Vaya, parece que hubo un error al crear el préstamo: ' + error.message, true);
        console.error('Error RPC create_amortization_schedule:', error);
    } else {
        showNotification('Préstamo y calendario de pagos creados con éxito.', false);
        closeLoanModal();
        loadLoans(); // Recargar la tabla de préstamos
        loadAdminDashboard(); // Actualizar KPIs
    }
}
// Guardar (Crear) Préstamo
async function handleLoanSubmit(e) {
    e.preventDefault();
    const formData = new FormData(loanForm);
    const loanId = loanIdInput.value;

    if (loanId) {
        showNotification('La edición de préstamos aún no está implementada.', true);
        return;
    }

    // Recalcular valores para asegurar consistencia
    const amount = parseFloat(formData.get('amount')) || 0;
    const interestRate = parseFloat(formData.get('interest_rate')) || 0;
    const totalPayments = parseInt(formData.get('total_payments')) || 0;

    // Datos para la función RPC
    const loanData = {
        p_client_id: formData.get('client_id'),
        p_amount: amount,
        p_interest_rate: interestRate / 100, // IMPORTANTE: Convertir a decimal
        p_total_payments: totalPayments,
        p_term_type: formData.get('term_type'),
        p_issue_date: formData.get('issue_date'),
        p_first_payment_date: formData.get('first_payment_date'),
        p_collection_method: formData.get('collection_method'),
        p_route_id: null, 
        p_cobrador_id: null, 
    };
    
    // Validaciones
    if (!loanData.p_client_id || !loanData.p_amount > 0 || !loanData.p_interest_rate > 0 || !loanData.p_total_payments > 0) {
        showNotification('Formulario incompleto. Revise los campos.', true);
        return;
    }
    
    showLoading(true);

    // Buscar ruta y cobrador
    try {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('route_id')
            .eq('id', loanData.p_client_id)
            .single();
        
        if (clientError) throw clientError;
        
        loanData.p_route_id = clientData.route_id;

        if(clientData.route_id) {
            const { data: cobradorData } = await supabase
                .from('profiles')
                .select('id')
                .eq('route_id', clientData.route_id)
                .eq('role', 'cobrador')
                .limit(1) 
                .single();
            
            if (cobradorData) {
                loanData.p_cobrador_id = cobradorData.id;
            }
        }

    } catch (error) {
        console.warn('No se pudo asignar cobrador automáticamente:', error.message);
    }

    // Llama al NUEVO RPC de amortización (Línea crítica, ahora dentro de la función)
    const { data, error } = await supabase.rpc('create_amortization_schedule', loanData);

    showLoading(false);

    if (error) {
        showNotification('Error al crear el préstamo: ' + error.message, true);
        console.error('Error RPC create_amortization_schedule:', error);
    } else {
        showNotification('Préstamo y calendario de pagos creados con éxito.', false);
        closeLoanModal();
        loadLoans(); // Recargar la tabla de préstamos
        loadAdminDashboard(); // Actualizar KPIs
    }
}
// (NUEVO) Borrar Préstamo
async function handleDeleteLoan(loanId, clientName) {
    openConfirmationModal(`¿Seguro que quieres borrar el préstamo de "${clientName}"? Se borrarán también todas sus cuotas y abonos registrados. Esta acción no se puede deshacer.`, async () => {
        showLoading(true);
        
        // 1. Borrar pagos (payments)
        const { error: pmtError } = await supabase.from('payments').delete().eq('loan_id', loanId);
        // 2. Borrar calendario (payment_schedule)
        const { error: schError } = await supabase.from('payment_schedule').delete().eq('loan_id', loanId);
        // 3. Borrar préstamo (loans)
        const { error: loanError } = await supabase.from('loans').delete().eq('id', loanId);
        
        showLoading(false);
        
        if (pmtError || schError || loanError) {
            showNotification('Vaya, parece que hubo un error al borrar: ' + (pmtError?.message || schError?.message || loanError?.message), true);
        } else {
            showNotification('Préstamo borrado con éxito.', false);
            loadLoans(); // Recargar la tabla
            loadAdminDashboard(); // Actualizar KPIs
        }
    });
}



// ===================================================
// MÓDULO 1.4: REPORTES Y ESTADÍSTICAS (ADMIN)
// ===================================================

// Cargar el Dashboard de Inicio (KPIs)
async function loadAdminDashboard() {
    if (userRole !== 'admin') return;
    
    showLoading(true);
    
    // Llamar a la función RPC para obtener los KPIs
    const { data: kpis, error } = await supabase.rpc('get_admin_kpis').single();

    showLoading(false);

    if (error) {
        showNotification('Error al cargar KPIs: ' + error.message, true);
        console.error('Error RPC get_admin_kpis:', error);
        return;
    }

    // Renderizar los KPIs
    if (kpis) {
        kpiTotalLoaned.textContent = formatCurrency(kpis.total_loaned);
        kpiTotalCollected.textContent = formatCurrency(kpis.total_collected);
        kpiInterestEarned.textContent = formatCurrency(kpis.total_interest_earned);
        kpiActiveLoans.textContent = kpis.active_loans_count.toLocaleString();
    }
}

// Cargar el Dashboard de Reportes (Tabla)
async function loadReportsDashboard() {
    if (userRole !== 'admin') return;
    
    showLoading(true);
    
    // Llamar a la función RPC para obtener el reporte de estados
    const { data: report, error } = await supabase.rpc('get_loan_status_report');

    showLoading(false);

    if (error) {
        showNotification('Error al cargar Reporte: ' + error.message, true);
        console.error('Error RPC get_loan_status_report:', error);
        reportsStatusTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-red-500 py-4">Error al cargar datos.</td></tr>`;
        return;
    }

    renderReportsTable(report);
}

// Renderizar la tabla de Reportes por Estado
function renderReportsTable(report) {
    if (!reportsStatusTableBody) return;
    reportsStatusTableBody.innerHTML = '';

    if (report.length === 0) {
        reportsStatusTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">No hay datos de préstamos para el reporte.</td></tr>`;
        return;
    }

    report.forEach(item => {
        let statusClass = 'bg-gray-100 text-gray-700';
        if (item.status === 'activo') statusClass = 'bg-blue-100 text-blue-800';
        else if (item.status === 'moroso') statusClass = 'bg-red-100 text-red-800';
        else if (item.status === 'liquidado') statusClass = 'bg-green-100 text-green-800';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-5 py-3 whitespace-nowrap text-sm font-medium">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${item.status}</span>
            </td>
            <td class="px-5 py-3 whitespace-nowrap text-sm text-gray-700">${item.loan_count.toLocaleString()}</td>
            <td class="px-5 py-3 whitespace-nowrap text-sm text-gray-700 font-bold">${formatCurrency(item.total_amount)}</td>
        `;
        reportsStatusTableBody.appendChild(tr);
    });
}


// ===================================================
// MÓDULO 1.3: PAGOS Y CONTROL DE COBROS
// (Reutilizamos la lógica del módulo anterior)
// ===================================================

// Abrir modal de Pagos (Ver/Pagar)
async function handleViewLoan(loanId) {
    if (!loanId) return;
    showLoading(true);
    paymentForm.reset();
    paymentLoanIdInput.value = loanId;
    paymentModalTitle.textContent = `Detalle Préstamo #${loanId.substring(0, 8)}...`;
    
    // Poner fecha y hora actual en el formulario de pago
    setPaymentDateTimeToNow();

    // 1. Obtener datos del préstamo y cliente
    const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select(`
            *,
            clients ( first_name, last_name )
        `)
        .eq('id', loanId)
        .single();

    // 2. Obtener calendario de pagos
    const { data: schedule, error: scheduleError } = await supabase
        .from('payment_schedule')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_number', { ascending: true });
    
    // 3. Obtener historial de abonos
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_date', { ascending: false });

    showLoading(false);

    if (loanError || scheduleError || paymentsError) {
        showNotification('Error al cargar detalles del préstamo: ' + (loanError?.message || scheduleError?.message || paymentsError?.message), true);
        console.error('Error load details:', loanError, scheduleError, paymentsError);
        return;
    }

    // Renderizar toda la data en el modal
    renderLoanDetails(loan, schedule, payments);
    paymentModal.classList.remove('hidden');
}

// Rellenar el modal de pagos con los datos
function renderLoanDetails(loan, schedule, payments) {
    // Rellenar resumen
    loanDetailClient.textContent = loan.clients ? `${loan.clients.first_name} ${loan.clients.last_name}` : 'N/A';
    loanDetailAmount.textContent = formatCurrency(loan.amount);
    loanDetailTotal.textContent = formatCurrency(loan.total_to_pay);
    loanDetailStatus.innerHTML = `
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
            ${loan.status === 'activo' ? 'bg-blue-100 text-blue-800' : 
               loan.status === 'moroso' ? 'bg-red-100 text-red-800' : 
               'bg-green-100 text-green-800'}">
            ${loan.status}
        </span>
    `;

    // Rellenar tablas
    renderScheduleTable(schedule);
    renderPaymentsTable(payments);
}

// Renderizar tabla de calendario de cuotas
// Renderizar tabla de calendario de cuotas (AHORA CON AMORTIZACIÓN)
function renderScheduleTable(schedule) {
    paymentScheduleBody.innerHTML = '';
    // NOTA: Colspan 7 para la nueva tabla (Cuota, Fecha, Total, Interés, Capital, Saldo, Estado)
    if (schedule.length === 0) { 
        paymentScheduleBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">No se generó calendario.</td></tr>`;
        return;
    }
    schedule.forEach(item => {
        const tr = document.createElement('tr');
        // Nuevas variables de amortización
        const capitalDue = item.capital_due || 0; 
        const interestDue = item.interest_due || 0;
        const totalDue = (item.amount_due || 0); // Total de la cuota
        const currentPrincipal = item.current_principal || 0; // Saldo pendiente
        const amountPaid = item.amount_paid || 0;
        
        let status = item.status; 
        let statusClass = 'bg-gray-100 text-gray-700'; 
        
        if (status === 'pagado') {
            statusClass = 'bg-green-100 text-green-800';
        } else if (status === 'parcial') {
            statusClass = 'bg-yellow-100 text-yellow-800';
        }
        
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm text-center text-gray-700">${item.payment_number}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${formatDate(item.due_date).split(',')[0]}</td>
            <td class="px-4 py-3 text-sm text-gray-700 font-bold">${formatCurrency(totalDue)}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${formatCurrency(interestDue)}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${formatCurrency(capitalDue)}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${formatCurrency(currentPrincipal)}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                    ${status} ${status === 'parcial' ? `(${formatCurrency(amountPaid)})` : ''}
                </span>
            </td>
        `;
        paymentScheduleBody.appendChild(tr);
    });
}

// Renderizar tabla de historial de abonos
function renderPaymentsTable(payments) {
    if (!paymentHistoryBody) return;
    paymentHistoryBody.innerHTML = '';
    if (payments.length === 0) {
        // Colspan debe ser 5 para coincidir con el nuevo encabezado
        paymentHistoryBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">No se han registrado abonos.</td></tr>`; 
        return;
    }
    payments.forEach(payment => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-700">${formatDate(payment.payment_date)}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${formatCurrency(payment.amount_paid)}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${payment.method}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${payment.notes || ''}</td>
            <!-- NUEVO: Columna de botón -->
            <td class="px-4 py-3 text-sm text-right">
                <button data-payment-id="${payment.id}" data-loan-id="${payment.loan_id}" 
                        class="text-red-600 hover:text-red-900 delete-payment-btn">Borrar</button>
            </td>
        `; 
        paymentHistoryBody.appendChild(tr);
    });

    // (NUEVO) Conectar eventos para el botón de borrar
    document.querySelectorAll('.delete-payment-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const paymentId = e.target.dataset.paymentId;
            const loanId = e.target.dataset.loanId;
            handleDeletePayment(paymentId, loanId); // Llama a la nueva función
        });
    });
}

function closePaymentModal() {
    paymentModal.classList.add('hidden');
}

function setPaymentDateTimeToNow() {
    if(paymentDateField) {
        paymentDateField.value = getNowForDateTimeInput();
    }
}

// Registrar un nuevo pago (Abono)
async function handlePaymentSubmit(e) {
    e.preventDefault();
    const formData = new FormData(paymentForm);
    const loanId = paymentLoanIdInput.value;
    
    const paymentData = {
        p_loan_id: loanId,
        p_amount_paid: parseFloat(formData.get('amount_paid')),
        p_mora_paid: parseFloat(formData.get('mora_paid')) || 0,
        p_payment_date: formData.get('payment_date'),
        p_payment_method: formData.get('payment_method'),
        p_notes: formData.get('notes') || null
        // p_collector_id se obtiene del auth.uid() dentro del RPC
    };

    if (!paymentData.p_amount_paid > 0) {
        showNotification('El monto a pagar debe ser mayor a cero.', true);
        return;
    }
    if (!paymentData.p_payment_date) {
        showNotification('La fecha de pago es obligatoria.', true);
        return;
    }
    
    showLoading(true);

    // Llamar a la función RPC "inteligente" (la que actualizamos en Supabase)
    const { data, error } = await supabase.rpc('register_payment_and_update_status', paymentData);
    
    showLoading(false);

    if (error) {
        showNotification('Error al registrar el pago: ' + error.message, true);
        console.error('Error RPC register_payment:', error);
    } else {
        showNotification('Pago registrado con éxito.', false);
        // Recargar el modal completo para ver el estado actualizado y el historial
        handleViewLoan(loanId);
        // (NUEVO) Recargar KPIs después de un pago exitoso
        loadAdminDashboard();
    }
}

// ===================================================
// MÓDULO 2.1: GESTIÓN DE USUARIOS Y RUTAS
// ===================================================

// --- CRUD de Rutas ---

async function loadRoutesTable() {
    if (userRole !== 'admin' || !routesTableBody) return;
    showLoading(true);
    
    const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('name', { ascending: true });
    
    showLoading(false);

    if (error) {
        showNotification('Error al cargar rutas: ' + error.message, true);
        return;
    }
    renderRoutesTable(data);
}

function renderRoutesTable(routes) {
    routesTableBody.innerHTML = '';
    if (routes.length === 0) {
        routesTableBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">No hay rutas creadas.</td></tr>`;
        return;
    }
    routes.forEach(route => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${route.name}</td>
            <td class="px-4 py-3 text-right text-sm">
                <button data-route-id="${route.id}" class="text-indigo-600 hover:text-indigo-900 edit-route-btn">Editar</button>
                <button data-route-id="${route.id}" data-route-name="${route.name}" class="text-red-600 hover:text-red-900 ml-3 delete-route-btn">Borrar</button>
            </td>
        `;
        routesTableBody.appendChild(tr);
    });

    // Asignar eventos
    document.querySelectorAll('.edit-route-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const routeId = e.target.dataset.routeId;
            const { data, error } = await supabase.from('routes').select('*').eq('id', routeId).single();
            if (error) {
                showNotification('Error al cargar ruta: ' + error.message, true);
            } else {
                openRouteModal(data);
            }
        });
    });
    
    document.querySelectorAll('.delete-route-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const routeId = e.target.dataset.routeId;
            const routeName = e.target.dataset.routeName;
            handleDeleteRoute(routeId, routeName);
        });
    });
}

function openRouteModal(route = null) {
    routeForm.reset();
    if (route) {
        routeModalTitle.textContent = 'Editar Ruta';
        routeIdInput.value = route.id;
        routeForm.name.value = route.name;
        routeForm.description.value = route.description;
    } else {
        routeModalTitle.textContent = 'Nueva Ruta';
        routeIdInput.value = '';
    }
    routeModal.classList.remove('hidden');
}

function closeRouteModal() {
    routeModal.classList.add('hidden');
    routeForm.reset();
}

async function handleRouteSubmit(e) {
    e.preventDefault();
    const formData = new FormData(routeForm);
    const routeId = routeIdInput.value;
    
    const routeData = {
        name: formData.get('name'),
        description: formData.get('description') || null
    };

    showLoading(true);
    let error;
    if (routeId) {
        const { error: updateError } = await supabase.from('routes').update(routeData).eq('id', routeId);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('routes').insert([routeData]);
        error = insertError;
    }
    showLoading(false);

    if (error) {
        showNotification('Error al guardar ruta: ' + error.message, true);
    } else {
        showNotification(`Ruta ${routeId ? 'actualizada' : 'creada'} con éxito.`, false);
        closeRouteModal();
        loadRoutesTable();
    }
}

function handleDeleteRoute(routeId, routeName) {
    openConfirmationModal(`¿Seguro que quieres borrar la ruta "${routeName}"? Esto puede afectar a clientes y usuarios asignados.`, async () => {
        showLoading(true);
        const { error } = await supabase.from('routes').delete().eq('id', routeId);
        showLoading(false);
        if (error) {
            showNotification('Error al borrar ruta: ' + error.message, true);
        } else {
            showNotification('Ruta borrada.', false);
            loadRoutesTable();
        }
    });
}

// --- CRUD de Usuarios ---

async function loadUsersTable() {
    if (userRole !== 'admin' || !usersTableBody) return;
    showLoading(true);
    
    // CORRECCIÓN: Quitado 'email' del select, porque no existe en la tabla 'profiles'
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            id,
            full_name,
            role,
            route_id,
            routes ( name )
        `);
    
    showLoading(false);
    
    if (error) {
        showNotification('Error al cargar usuarios: ' + error.message, true);
        console.error('Error cargando usuarios:', error); // Mostrar error en consola
        return;
    }
    renderUsersTable(data);
}

function renderUsersTable(users) {
    usersTableBody.innerHTML = '';
    if (users.length === 0) {
        usersTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay usuarios.</td></tr>`;
        return;
    }
    users.forEach(user => {
        const routeName = user.routes ? user.routes.name : 'N/A';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        // CORRECCIÓN: Quitada la columna de 'email'
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${user.full_name}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${user.role}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${user.role === 'cobrador' ? routeName : '---'}</td>
            <td class="px-4 py-3 text-right text-sm">
                <button data-user-id="${user.id}" class="text-indigo-600 hover:text-indigo-900 edit-user-btn">Editar</button>
            </td>
        `;
        usersTableBody.appendChild(tr);
    });

    // Asignar eventos
    document.querySelectorAll('.edit-user-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const userId = e.target.dataset.userId;
            // CORRECCIÓN: Quitado 'email' del select
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role, route_id')
                .eq('id', userId)
                .single();
            if (error) {
                showNotification('Error al cargar usuario: ' + error.message, true);
            } else {
                openUserModal(data);
            }
        });
    });
}

async function loadRoutesForUserSelect() {
    if (!userRouteSelect) return;
    const { data, error } = await supabase.from('routes').select('id, name');
    if (error) {
        showNotification('Error al cargar rutas para el selector: ' + error.message, true);
        return;
    }
    userRouteSelect.innerHTML = '<option value="">Sin asignar</option>';
    data.forEach(route => {
        const option = document.createElement('option');
        option.value = route.id;
        option.textContent = route.name;
        userRouteSelect.appendChild(option);
    });
}

function openUserModal(user) {
    userForm.reset();
    loadRoutesForUserSelect(); // Cargar rutas en el select
    
    userModalTitle.textContent = `Editar Usuario: ${user.full_name}`;
    userIdInput.value = user.id;
    userFullNameDisplay.textContent = user.full_name;
    // CORRECCIÓN: Ocultar el campo de email ya que no lo tenemos
    userEmailDisplayEl.textContent = 'Email no disponible en perfiles.';
    userRoleSelect.value = user.role;
    userRouteSelect.value = user.route_id || '';
    
    userModal.classList.remove('hidden');
}

function closeUserModal() {
    userModal.classList.add('hidden');
    userForm.reset();
}

async function handleUserSubmit(e) {
    e.preventDefault();
    const formData = new FormData(userForm);
    const userId = userIdInput.value;
    
    const profileData = {
        role: formData.get('role'),
        route_id: formData.get('route_id') || null
    };

    // Un admin no puede tener ruta
    if (profileData.role === 'admin') {
        profileData.route_id = null;
    }

    showLoading(true);
    const { error } = await supabase.from('profiles').update(profileData).eq('id', userId);
    showLoading(false);

    if (error) {
        showNotification('Error al actualizar usuario: ' + error.message, true);
    } else {
        showNotification('Usuario actualizado con éxito.', false);
        closeUserModal();
        loadUsersTable();
    }
}
// ===================================================
// INICIALIZACIÓN (Setup)
// ===================================================

// Exponer funciones al objeto global 'window' para que Alpine.js pueda verlas
window.loadClients = loadClients;
window.loadLoans = loadLoans;
window.loadRoutesTable = loadRoutesTable;
window.loadUsersTable = loadUsersTable;
// (NUEVO) Exponer funciones de Reportes
window.loadAdminDashboard = loadAdminDashboard;
window.loadReportsDashboard = loadReportsDashboard;


document.addEventListener('DOMContentLoaded', () => {
    // Asignar elementos del DOM
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    authView = document.getElementById('auth-view');
    appView = document.getElementById('app-view');
    loadingIndicator = document.getElementById('loading-indicator');
    adminDashboard = document.getElementById('admin-dashboard');
    collectorDashboard = document.getElementById('collector-dashboard');
    userEmailDisplay = document.getElementById('user-email');
    logoutButton = document.getElementById('logout-button');
    notificationBox = document.getElementById('notification-box');
    adminTabs = document.getElementById('admin-tabs');
    
    // --- Clientes ---
    clientsTableBody = document.getElementById('clients-table-body');
    clientModal = document.getElementById('client-modal');
    clientForm = document.getElementById('client-form');
    closeClientModalBtn = document.getElementById('close-client-modal-btn');
    cancelClientModalBtn = document.getElementById('cancel-client-modal-btn');
    openClientModalBtn = document.getElementById('open-client-modal-btn');
    clientModalTitle = document.getElementById('client-modal-title');
    routeSelect = document.getElementById('route_id');
    clientIdInput = document.getElementById('client_id');
    clientSearchInput = document.getElementById('client-search-input'); // <-- AGREGA ESTA LÍNEA

    // --- Préstamos ---
    loansTableBody = document.getElementById('loans-table-body');
    loanModal = document.getElementById('loan-modal');
    loanForm = document.getElementById('loan-form');
    closeLoanModalBtn = document.getElementById('close-loan-modal-btn');
    cancelLoanModalBtn = document.getElementById('cancel-loan-modal-btn');
    openLoanModalBtn = document.getElementById('open-loan-modal-btn');
    loanModalTitle = document.getElementById('loan-modal-title');
    loanClientIdSelect = document.getElementById('loan_client_id');
    loanCalcResults = document.getElementById('loan-calc-results');
    loanIdInput = document.getElementById('loan_id');
    loanClientSearchInput = document.getElementById('loan_client_search'); // <-- AGREGA ESTA LÍNEA

    // --- Pagos ---
    paymentModal = document.getElementById('payment-modal');
    paymentForm = document.getElementById('payment-form');
    closePaymentModalBtn = document.getElementById('close-payment-modal-btn');
    paymentModalTitle = document.getElementById('payment-modal-title');
    paymentLoanIdInput = document.getElementById('payment_loan_id');
    loanDetailClient = document.getElementById('loan-detail-client');
    loanDetailAmount = document.getElementById('loan-detail-amount');
    loanDetailTotal = document.getElementById('loan-detail-total');
    loanDetailStatus = document.getElementById('loan-detail-status');
    paymentScheduleBody = document.getElementById('payment-schedule-body');
    paymentHistoryBody = document.getElementById('payment-history-body');
    paymentDateField = document.getElementById('payment_date');

    // --- Rutas ---
    routesTableBody = document.getElementById('routes-table-body');
    routeModal = document.getElementById('route-modal');
    routeForm = document.getElementById('route-form');
    closeRouteModalBtn = document.getElementById('close-route-modal-btn');
    cancelRouteModalBtn = document.getElementById('cancel-route-modal-btn');
    openRouteModalBtn = document.getElementById('open-route-modal-btn');
    routeModalTitle = document.getElementById('route-modal-title');
    routeIdInput = document.getElementById('route_id_input');

    // --- Usuarios ---
    usersTableBody = document.getElementById('users-table-body');
    userModal = document.getElementById('user-modal');
    userForm = document.getElementById('user-form');
    closeUserModalBtn = document.getElementById('close-user-modal-btn');
    cancelUserModalBtn = document.getElementById('cancel-user-modal-btn');
    userModalTitle = document.getElementById('user-modal-title');
    userIdInput = document.getElementById('user_id_input');
    userFullNameDisplay = document.getElementById('user_full_name');
    userEmailDisplayEl = document.getElementById('user_email_display');
    userRoleSelect = document.getElementById('user_role');
    userRouteSelect = document.getElementById('user_route_id');
    
    // --- (NUEVO) Reportes ---
    kpiTotalLoaned = document.getElementById('kpi-total-loaned');
    kpiTotalCollected = document.getElementById('kpi-total-collected');
    kpiInterestEarned = document.getElementById('kpi-interest-earned');
    kpiActiveLoans = document.getElementById('kpi-active-loans');
    reportsStatusTableBody = document.getElementById('reports-status-table-body');


    // --- Confirmación ---
    confirmationModal = document.getElementById('confirmation-modal');
    confirmText = document.getElementById('confirm-text');
    confirmButton = document.getElementById('confirm-button');
    cancelConfirmButton = document.getElementById('cancel-confirm-button');

    // Asignar eventos
    if(loginForm) loginForm.addEventListener('submit', handleLogin);
    if(registerForm) registerForm.addEventListener('submit', handleRegister);
    if(logoutButton) logoutButton.addEventListener('click', handleLogout);

    // --- Eventos Clientes ---
    if(openClientModalBtn) openClientModalBtn.addEventListener('click', () => openClientModal(null));
    if(closeClientModalBtn) closeClientModalBtn.addEventListener('click', closeClientModal);
    if(cancelClientModalBtn) cancelClientModalBtn.addEventListener('click', closeClientModal);
    if(clientForm) clientForm.addEventListener('submit', handleClientSubmit);
    if(clientModal) clientModal.addEventListener('click', (e) => e.target === clientModal && closeClientModal());
    if(clientSearchInput) clientSearchInput.addEventListener('keyup', loadClients); // <-- AGREGA ESTA LÍNEA

   // --- Eventos Préstamos ---
    if(openLoanModalBtn) openLoanModalBtn.addEventListener('click', () => { // MODIFICADO
        openLoanModal(null);
        loadClientsForDropdown(''); // Carga inicial sin filtro
    });
    if(closeLoanModalBtn) closeLoanModalBtn.addEventListener('click', closeLoanModal);
    if(cancelLoanModalBtn) cancelLoanModalBtn.addEventListener('click', closeLoanModal);
    if(loanForm) loanForm.addEventListener('submit', handleLoanSubmit);
    if(loanModal) loanModal.addEventListener('click', (e) => e.target === loanModal && closeLoanModal());
    
    // (NUEVO) Evento para la búsqueda en el modal
    if(loanClientSearchInput) loanClientSearchInput.addEventListener('keyup', (e) => { 
        loadClientsForDropdown(e.target.value);
    });
    
    // (AÑADIDO OTRA VEZ) Eventos para la calculadora
    const calcInputs = ['amount', 'interest_rate', 'total_payments', 'term_type'];
    calcInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateLoanTotals);
    });

    // --- Eventos Pagos ---
    if(closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closePaymentModal);
    if(paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);
    if(paymentModal) paymentModal.addEventListener('click', (e) => e.target === paymentModal && closePaymentModal());
    
    
    // --- Eventos Rutas ---
    if(openRouteModalBtn) openRouteModalBtn.addEventListener('click', () => openRouteModal(null));
    if(closeRouteModalBtn) closeRouteModalBtn.addEventListener('click', closeRouteModal);
    if(cancelRouteModalBtn) cancelRouteModalBtn.addEventListener('click', closeRouteModal);
    if(routeForm) routeForm.addEventListener('submit', handleRouteSubmit);
    if(routeModal) routeModal.addEventListener('click', (e) => e.target === routeModal && closeRouteModal());

    // --- Eventos Usuarios ---
    if(closeUserModalBtn) closeUserModalBtn.addEventListener('click', closeUserModal);
    if(cancelUserModalBtn) cancelUserModalBtn.addEventListener('click', closeUserModal);
    if(userForm) userForm.addEventListener('submit', handleUserSubmit);
    if(userModal) userModal.addEventListener('click', (e) => e.target === userModal && closeUserModal());

    // --- Eventos Confirmación ---
    if(confirmButton) confirmButton.addEventListener('click', handleConfirm);
    if(cancelConfirmButton) cancelConfirmButton.addEventListener('click', closeConfirmationModal);


    // --- Listener de Autenticación (¡El más importante!) ---
    if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, session);
            updateUIBasedOnAuth(session);
        });
    }

});







