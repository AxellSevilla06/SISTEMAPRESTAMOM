// -----------------------------------------------------------------
// CONFIGURACIÓN DE SUPABASE
// -----------------------------------------------------------------
const SUPABASE_URL = 'https://kscmbggubxgkaroojxoa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY21iZ2d1Ynhna2Fyb29qeG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMjYwMzMsImV4cCI6MjA3ODcwMjAzM30.w1xq1N8ba0m99I0vEMAfSC2sgmdQYN53qW4-DJRyJb0';

let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("Supabase URL/Key no configurada.");
    }
    
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

} catch (error) {
    console.warn(error.message);
    document.addEventListener('DOMContentLoaded', () => {
        const appView = document.getElementById('app-view');
        if(appView) {
            appView.innerHTML = `<div class="max-w-md mx-auto mt-10 p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-lg">Error de Conexión.</div>`;
            document.getElementById('auth-view').classList.add('hidden');
        }
    });
}
        
// --- Selectores de UI (Globales) ---
let loginForm, registerForm, authView, appView, loadingIndicator;
let adminDashboard, collectorDashboard, userEmailDisplay, logoutButton;
let notificationBox, adminTabs;
let clientsTableBody, clientModal, clientForm, closeClientModalBtn, clientModalTitle, routeSelect, clientIdInput;
let openClientModalBtn, cancelClientModalBtn;
let loansTableBody, loanModal, loanForm, closeLoanModalBtn, loanModalTitle, loanClientIdSelect;
let openLoanModalBtn, cancelLoanModalBtn, loanCalcResults, loanIdInput;
let paymentModal, paymentForm, closePaymentModalBtn, paymentModalTitle, paymentLoanIdInput;
let loanDetailClient, loanDetailAmount, loanDetailTotal, loanDetailStatus;
let paymentScheduleBody, paymentHistoryBody, paymentDateField;
let routesTableBody, routeModal, routeForm, closeRouteModalBtn, routeModalTitle, routeIdInput;
let openRouteModalBtn, cancelRouteModalBtn;
let usersTableBody, userModal, userForm, closeUserModalBtn, cancelUserModalBtn, userModalTitle, userIdInput;
let userFullNameDisplay, userEmailDisplayEl, userRoleSelect, userRouteSelect;
let kpiTotalLoaned, kpiTotalCollected, kpiInterestEarned, kpiActiveLoans;
let reportsStatusTableBody;
let collectorLoansTableBody;
let clientSearchInput; 
let loanClientSearchInput; 
let confirmationModal, confirmText, confirmButton, cancelConfirmButton;
let confirmCallback = null;

// --- Estado de la Aplicación ---
let currentUser = null;
let userRole = null;

// ===================================================
// INICIO DE FUNCIONES GLOBALES (Borrar Abono y Borrar Préstamo)
// ===================================================

function handleDeletePayment(paymentId, loanId) {
    openConfirmationModal(`¿Estás seguro de que quieres borrar este abono? El sistema recalculará el saldo del préstamo.`, async () => {
        showLoading(true);

        const { error } = await supabase.rpc('delete_payment_and_recalculate', {
            p_payment_id: paymentId, p_loan_id: loanId
        });

        showLoading(false);

        if (error) {
            showNotification('Error al borrar el abono: ' + error.message, true);
        } else {
            showNotification('Abono borrado. El préstamo ha sido recalculado.', false);
            handleViewLoan(loanId);
            loadLoans();
            loadAdminDashboard();
        }
    });
}

async function handleDeleteLoan(loanId, clientName) {
    openConfirmationModal(`¿Seguro que quieres borrar el préstamo de "${clientName}"? Se borrarán también todas sus cuotas y abonos registrados. Esta acción no se puede deshacer.`, async () => {
        showLoading(true);
        
        const { error: pmtError } = await supabase.from('payments').delete().eq('loan_id', loanId);
        const { error: schError } = await supabase.from('payment_schedule').delete().eq('loan_id', loanId);
        const { error: loanError } = await supabase.from('loans').delete().eq('id', loanId);
        
        showLoading(false);
        
        if (pmtError || schError || loanError) {
            showNotification('Error al borrar: ' + (pmtError?.message || schError?.message || loanError?.message), true);
        } else {
            showNotification('Préstamo borrado con éxito.', false);
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
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getTodayForInput() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
}

function getNowForDateTimeInput() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}
// --- Funciones de Autenticación (Continúa aquí) ---
async function handleRegister(e) {
    e.preventDefault();
    const email = registerForm.email.value;
    const password = registerForm.password.value;
    const role = registerForm.role.value;
    const fullName = registerForm.full_name.value;

    showLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { role: role, full_name: fullName } }
    });
    showLoading(false);

    if (error) { showNotification(`Error al registrar: ${error.message}`, true); }
    else { showNotification('Registro exitoso. Revisa tu email.', false); registerForm.reset(); if (window.Alpine) Alpine.data(document.querySelector('[x-data]')).tab = 'login'; }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    showLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    showLoading(false);
    if (error) showNotification(`Error al iniciar sesión: ${error.message}`, true);
    else showNotification('Inicio de sesión exitoso.', false);
}

async function handleLogout() {
    showLoading(true);
    const { error } = await supabase.auth.signOut();
    showLoading(false);
    if (error) showNotification(`Error al cerrar sesión: ${error.message}`, true);
    else showNotification('Sesión cerrada.', false);
}

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
            loadAdminDashboard();
        } else if (userRole === 'cobrador') {
            adminDashboard.classList.add('hidden');
            collectorDashboard.classList.remove('hidden');
            loadCollectorDashboard(); 
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

async function loadRoutes() {
    if (userRole !== 'admin' || !routeSelect) return;
    const { data } = await supabase.from('routes').select('id, name');
    routeSelect.innerHTML = '<option value="">Sin asignar</option>';
    data.forEach(route => {
        const option = document.createElement('option');
        option.value = route.id;
        option.textContent = route.name;
        routeSelect.appendChild(option);
    });
}

async function loadClients() {
    if (userRole !== 'admin' || !clientsTableBody) return;
    showLoading(true);
    
    const searchTerm = clientSearchInput ? clientSearchInput.value.trim() : '';
    
    let query = supabase.from('clients').select(`id, first_name, last_name, phone, status, route_id, routes ( name )`);

    if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,personal_id_number.ilike.%${searchTerm}%`);
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    showLoading(false);

    renderClientsTable(data);
}

function renderClientsTable(clients) {
    if (!clientsTableBody) return;
    clientsTableBody.innerHTML = '';
    if (clients.length === 0) {
        clientsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay clientes registrados.</td></tr>`;
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
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${client.status === 'activo' ? 'bg-green-100 text-green-800' : client.status === 'moroso' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-700'}">${client.status}</span>
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${routeName}</td>
            <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-client-id="${client.id}" class="text-indigo-600 hover:text-indigo-900 edit-client-btn">Editar</button>
                <button data-client-id="${client.id}" data-client-name="${client.first_name} ${client.last_name}" class="text-red-600 hover:text-red-900 ml-4 delete-client-btn">Borrar</button>
            </td>
        `;
        clientsTableBody.appendChild(tr);
    });

    document.querySelectorAll('.edit-client-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const { data: clientData } = await supabase.from('clients').select('*').eq('id', e.target.dataset.clientId).single();
            openClientModal(clientData);
        });
    });

    document.querySelectorAll('.delete-client-btn').forEach(button => {
        button.addEventListener('click', (e) => handleDeleteClient(e.target.dataset.clientId, e.target.dataset.clientName));
    });
}
function openClientModal(client = null) {
    clientForm.reset();
    loadRoutes();
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

async function handleClientSubmit(e) {
    e.preventDefault();
    const formData = new FormData(clientForm);
    const clientId = clientIdInput.value;
    let referencesJson = null;
    try { if (formData.get('references').trim()) referencesJson = JSON.parse(formData.get('references')); } catch (error) { return showNotification('Referencias JSON inválido.', true); }

    const clientData = {
        first_name: formData.get('first_name'), last_name: formData.get('last_name'),
        phone: formData.get('phone') || null, address: formData.get('address') || null,
        email: formData.get('email') || null, personal_id_number: formData.get('personal_id_number') || null,
        status: formData.get('status'), route_id: formData.get('route_id') || null, "references": referencesJson
    };

    if (!clientId) clientData.created_by = currentUser.id;

    showLoading(true);
    let error;
    if (clientId) { const { error: uErr } = await supabase.from('clients').update(clientData).eq('id', clientId); error = uErr; }
    else { const { error: iErr } = await supabase.from('clients').insert([clientData]); error = iErr; }
    showLoading(false);

    if (error) showNotification('Error al guardar: ' + error.message, true);
    else { showNotification('Cliente guardado.', false); closeClientModal(); loadClients(); }
}

function handleDeleteClient(clientId, clientName) {
    openConfirmationModal(`¿Borrar a ${clientName}?`, async () => {
        showLoading(true);
        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        showLoading(false);
        if (error) showNotification('Error al borrar: ' + error.message, true);
        else { showNotification('Cliente borrado.', false); loadClients(); }
    });
}
// ===================================================
// MÓDULO 1.2: GESTIÓN DE PRÉSTAMOS
// ===================================================

async function loadClientsForDropdown(searchTerm = '') {
    if (userRole !== 'admin' || !loanClientIdSelect) return;

    let query = supabase.from('clients').select('id, first_name, last_name, personal_id_number').eq('status', 'activo').order('first_name', { ascending: true });

    if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,personal_id_number.ilike.%${searchTerm}%`);
    } else {
        query = query.limit(50);
    }

    const { data } = await query;
    loanClientIdSelect.innerHTML = '<option value="">Seleccione un cliente</option>';
    data.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        const displayId = client.personal_id_number ? client.personal_id_number.substring(0,5)+'...' : 'ID';
        option.textContent = `${client.first_name} ${client.last_name} (${displayId})`;
        loanClientIdSelect.appendChild(option);
    });
}

async function loadLoans() {
    if (userRole !== 'admin' || !loansTableBody) return;
    showLoading(true);
    
    const searchTerm = clientSearchInput ? clientSearchInput.value.trim() : '';
    let query = supabase.from('loans').select(`id, client_id, amount, total_to_pay, total_interest, total_payments, term_type, status, clients ( first_name, last_name, phone, personal_id_number )`);

    if (searchTerm) {
        query = query.or(`clients.first_name.ilike.%${searchTerm}%,clients.last_name.ilike.%${searchTerm}%,clients.phone.ilike.%${searchTerm}%,clients.personal_id_number.ilike.%${searchTerm}%`);
    }

    const { data } = await query.order('created_at', { ascending: false });
    showLoading(false);

    renderLoansTable(data);
}

function renderLoansTable(loans) {
    if (!loansTableBody) return;
    loansTableBody.innerHTML = '';
    if (loans.length === 0) {
        loansTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay préstamos registrados.</td></tr>`;
        return;
    }

    loans.forEach(loan => {
        const clientName = loan.clients ? `${loan.clients.first_name} ${loan.clients.last_name}` : 'Cliente Borrado';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
            <td class="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${clientName}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${formatCurrency(loan.amount)}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${formatCurrency(loan.total_interest)}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600 font-bold">${formatCurrency(loan.total_to_pay)}</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-600">${loan.total_payments} ${loan.term_type}s</td>
            <td class="px-5 py-4 whitespace-nowrap text-sm">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${loan.status === 'activo' ? 'bg-blue-100 text-blue-800' : loan.status === 'moroso' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">${loan.status}</span>
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-loan-id="${loan.id}" class="text-green-600 hover:text-green-900 view-loan-btn">Ver/Pagar</button>
                <button data-loan-id="${loan.id}" data-client-name="${clientName}" class="text-red-600 hover:text-red-900 ml-4 delete-loan-btn">Borrar</button>
            </td>
        `;
        loansTableBody.appendChild(tr);
    });

    document.querySelectorAll('.view-loan-btn').forEach(button => {
        button.addEventListener('click', (e) => handleViewLoan(e.target.dataset.loanId));
    });

    document.querySelectorAll('.delete-loan-btn').forEach(button => {
        button.addEventListener('click', (e) => handleDeleteLoan(e.target.dataset.loanId, e.target.dataset.clientName));
    });
}
function openLoanModal(loan = null) {
    loanForm.reset();
    loadClientsForDropdown(); 
    const today = getTodayForInput();
    loanForm.issue_date.value = today;
    const issueDate = new Date(); issueDate.setDate(issueDate.getDate() + 7);
    loanForm.first_payment_date.value = issueDate.toISOString().slice(0, 10);

    if (loan) {
        loanModalTitle.textContent = 'Editar Préstamo (No implementado)';
    } else {
        loanModalTitle.textContent = 'Nuevo Préstamo';
        loanIdInput.value = '';
    }
    loanModal.classList.remove('hidden');
    calculateLoanTotals();
}

function closeLoanModal() {
    loanModal.classList.add('hidden');
    loanForm.reset();
}

function calculateLoanTotals() {
    if (!loanForm) return;
    const amount = parseFloat(loanForm.amount.value) || 0;
    const interestRate = parseFloat(loanForm.interest_rate.value) || 0;
    const totalPayments = parseInt(loanForm.total_payments.value) || 0;

    if (amount > 0 && interestRate > 0 && totalPayments > 0) {
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
        loanCalcResults.innerHTML = '';
    }
}

async function handleLoanSubmit(e) {
    e.preventDefault();
    const formData = new FormData(loanForm);
    const loanId = loanIdInput.value;

    if (loanId) {
        showNotification('La edición de préstamos aún no está implementada.', true);
        return;
    }

    const amount = parseFloat(formData.get('amount')) || 0;
    const interestRate = parseFloat(formData.get('interest_rate')) || 0;
    const totalPayments = parseInt(formData.get('total_payments')) || 0;

    const loanData = {
        p_client_id: formData.get('client_id'),
        p_amount: amount,
        p_interest_rate: interestRate / 100, 
        p_total_payments: totalPayments,
        p_term_type: formData.get('term_type'),
        p_issue_date: formData.get('issue_date'),
        p_first_payment_date: formData.get('first_payment_date'),
        p_collection_method: formData.get('collection_method'),
        p_route_id: null, p_cobrador_id: null
    };
    
    if (!loanData.p_client_id || !loanData.p_amount > 0) return showNotification('Formulario incompleto.', true);
    
    showLoading(true);

    try {
        const { data: clientData } = await supabase.from('clients').select('route_id').eq('id', loanData.p_client_id).single();
        if (clientData) {
            loanData.p_route_id = clientData.route_id;
            if(clientData.route_id) {
                const { data: cobradorData } = await supabase.from('profiles').select('id').eq('route_id', clientData.route_id).eq('role', 'cobrador').limit(1).single();
                if (cobradorData) loanData.p_cobrador_id = cobradorData.id;
            }
        }
    } catch (error) { console.warn('Sin cobrador auto.'); }

    // LLamada al RPC de Amortización Francesa
    const { data, error } = await supabase.rpc('create_amortization_schedule', loanData);

    showLoading(false);

    if (error) {
        showNotification('Error al crear el préstamo: ' + error.message, true);
        console.error('Error RPC create_amortization_schedule:', error);
    } else {
        showNotification('Préstamo y calendario de pagos creados con éxito.', false);
        closeLoanModal();
        loadLoans(); 
    }
}
// ===================================================
// MÓDULO 1.3: PAGOS Y CONTROL DE COBROS
// ===================================================

async function handleViewLoan(loanId) {
    if (!loanId) return;
    showLoading(true);
    paymentForm.reset();
    paymentLoanIdInput.value = loanId;
    paymentModalTitle.textContent = `Detalle Préstamo #${loanId.substring(0, 8)}...`;
    setPaymentDateTimeToNow();

    const { data: loan } = await supabase.from('loans').select(`*, clients ( first_name, last_name )`).eq('id', loanId).single();
    const { data: schedule } = await supabase.from('payment_schedule').select('*').eq('loan_id', loanId).order('payment_number', { ascending: true });
    const { data: payments } = await supabase.from('payments').select('*').eq('loan_id', loanId).order('payment_date', { ascending: false });

    showLoading(false);
    renderLoanDetails(loan, schedule, payments);
    paymentModal.classList.remove('hidden');
}

function renderLoanDetails(loan, schedule, payments) {
    loanDetailClient.textContent = loan.clients ? `${loan.clients.first_name} ${loan.clients.last_name}` : 'N/A';
    loanDetailAmount.textContent = formatCurrency(loan.amount);
    loanDetailTotal.textContent = formatCurrency(loan.total_to_pay);
    loanDetailStatus.innerHTML = `<span class="px-2 rounded-full bg-blue-100 text-blue-800">${loan.status}</span>`;
    renderScheduleTable(schedule);
    renderPaymentsTable(payments);
}

function renderScheduleTable(schedule) {
    paymentScheduleBody.innerHTML = '';
    // Colspan 7 para la tabla de amortización
    if (schedule.length === 0) { 
        paymentScheduleBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">No se generó calendario.</td></tr>`;
        return;
    }
    schedule.forEach(item => {
        const tr = document.createElement('tr');
        const capitalDue = item.capital_due || 0; 
        const interestDue = item.interest_due || 0;
        const totalDue = (item.amount_due || 0); 
        const currentPrincipal = item.current_principal || 0; 
        const amountPaid = item.amount_paid || 0;
        let status = item.status; 
        let statusClass = item.status === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';
        
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm text-center">${item.payment_number}</td>
            <td class="px-4 py-3 text-sm">${formatDate(item.due_date).split(',')[0]}</td>
            <td class="px-4 py-3 text-sm font-bold">${formatCurrency(totalDue)}</td>
            <td class="px-4 py-3 text-sm">${formatCurrency(interestDue)}</td>
            <td class="px-4 py-3 text-sm">${formatCurrency(capitalDue)}</td>
            <td class="px-4 py-3 text-sm">${formatCurrency(currentPrincipal)}</td>
            <td class="px-4 py-3 text-sm"><span class="px-2 rounded-full ${statusClass}">${status}</span></td>
        `;
        paymentScheduleBody.appendChild(tr);
    });
}

function renderPaymentsTable(payments) {
    if (!paymentHistoryBody) return;
    paymentHistoryBody.innerHTML = '';
    if (payments.length === 0) {
        paymentHistoryBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">No se han registrado abonos.</td></tr>`; 
        return;
    }
    payments.forEach(payment => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm">${formatDate(payment.payment_date)}</td>
            <td class="px-4 py-3 text-sm font-bold">${formatCurrency(payment.amount_paid)}</td>
            <td class="px-4 py-3 text-sm">${payment.method}</td>
            <td class="px-4 py-3 text-sm">${payment.notes || ''}</td>
            <td class="px-4 py-3 text-sm text-right">
                <button data-payment-id="${payment.id}" data-loan-id="${payment.loan_id}" class="text-red-600 hover:text-red-900 delete-payment-btn">Borrar</button>
            </td>
        `; 
        paymentHistoryBody.appendChild(tr);
    });

    document.querySelectorAll('.delete-payment-btn').forEach(button => {
        button.addEventListener('click', (e) => handleDeletePayment(e.target.dataset.paymentId, e.target.dataset.loanId));
    });
}

function closePaymentModal() {
    paymentModal.classList.add('hidden');
}

function setPaymentDateTimeToNow() {
    if(paymentDateField) paymentDateField.value = getNowForDateTimeInput();
}

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
    };

    if (!paymentData.p_amount_paid > 0) return showNotification('Monto inválido.', true);
    
    showLoading(true);
    const { error } = await supabase.rpc('register_payment_and_recalculate', paymentData);
    showLoading(false);

    if (error) {
        showNotification('Error al registrar: ' + error.message, true);
    } else {
        showNotification('Pago registrado.', false);
        handleViewLoan(loanId);
        loadAdminDashboard();
    }
}
// ===================================================
// MÓDULO 1.4: REPORTES Y ESTADÍSTICAS
// ===================================================

async function loadAdminDashboard() {
    if (userRole !== 'admin') return;
    showLoading(true);
    const { data: kpis } = await supabase.rpc('get_admin_kpis').single();
    showLoading(false);

    if (kpis) {
        kpiTotalLoaned.textContent = formatCurrency(kpis.total_loaned);
        kpiTotalCollected.textContent = formatCurrency(kpis.total_collected);
        kpiInterestEarned.textContent = formatCurrency(kpis.total_interest_earned);
        kpiActiveLoans.textContent = kpis.active_loans_count.toLocaleString();
    }
}

async function loadReportsDashboard() {
    if (userRole !== 'admin') return;
    showLoading(true);
    const { data: report } = await supabase.rpc('get_loan_status_report');
    showLoading(false);
    renderReportsTable(report || []);
}

function renderReportsTable(report) {
    if (!reportsStatusTableBody) return;
    reportsStatusTableBody.innerHTML = '';
    report.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-5 py-3"><span class="px-2 rounded-full bg-gray-200">${item.status}</span></td>
            <td class="px-5 py-3">${item.loan_count}</td>
            <td class="px-5 py-3 font-bold">${formatCurrency(item.total_amount)}</td>
        `;
        reportsStatusTableBody.appendChild(tr);
    });
}

// ===================================================
// MÓDULO 2.1: GESTIÓN DE USUARIOS Y RUTAS
// ===================================================

async function loadRoutesTable() {
    if (userRole !== 'admin' || !routesTableBody) return;
    const { data } = await supabase.from('routes').select('*').order('name');
    renderRoutesTable(data || []);
}

function renderRoutesTable(routes) {
    routesTableBody.innerHTML = '';
    routes.forEach(route => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-4 py-3 font-medium">${route.name}</td><td class="px-4 py-3 text-right"><button data-route-id="${route.id}" class="delete-route-btn text-red-600">Borrar</button></td>`;
        routesTableBody.appendChild(tr);
    });
    document.querySelectorAll('.delete-route-btn').forEach(btn => btn.addEventListener('click', (e) => handleDeleteRoute(e.target.dataset.routeId)));
}

async function handleRouteSubmit(e) {
    e.preventDefault();
    const formData = new FormData(routeForm);
    await supabase.from('routes').insert([{ name: formData.get('name'), description: formData.get('description') }]);
    closeRouteModal();
    loadRoutesTable();
}

function handleDeleteRoute(routeId) {
    openConfirmationModal("¿Borrar ruta?", async () => {
        await supabase.from('routes').delete().eq('id', routeId);
        loadRoutesTable();
    });
}

async function loadUsersTable() {
    if (userRole !== 'admin' || !usersTableBody) return;
    const { data } = await supabase.from('profiles').select(`id, full_name, role, route_id, routes(name)`);
    renderUsersTable(data || []);
}

function renderUsersTable(users) {
    usersTableBody.innerHTML = '';
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-4 py-3 font-medium">${user.full_name}</td><td class="px-4 py-3">${user.role}</td><td class="px-4 py-3">${user.routes ? user.routes.name : '-'}</td><td class="px-4 py-3 text-right"><button data-user-id="${user.id}" class="edit-user-btn text-indigo-600">Editar</button></td>`;
        usersTableBody.appendChild(tr);
    });
    document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        const { data } = await supabase.from('profiles').select('id, full_name, role, route_id').eq('id', e.target.dataset.userId).single();
        openUserModal(data);
    }));
}

function openUserModal(user) {
    userForm.reset();
    loadRoutesForUserSelect();
    userIdInput.value = user.id;
    userFullNameDisplay.textContent = user.full_name;
    userRoleSelect.value = user.role;
    userRouteSelect.value = user.route_id || '';
    userModal.classList.remove('hidden');
}

function closeUserModal() { userModal.classList.add('hidden'); }

async function handleUserSubmit(e) {
    e.preventDefault();
    const formData = new FormData(userForm);
    const profileData = { role: formData.get('role'), route_id: formData.get('route_id') || null };
    if (profileData.role === 'admin') profileData.route_id = null;
    await supabase.from('profiles').update(profileData).eq('id', userIdInput.value);
    closeUserModal();
    loadUsersTable();
}

async function loadRoutesForUserSelect() {
    const { data } = await supabase.from('routes').select('id, name');
    userRouteSelect.innerHTML = '<option value="">Sin asignar</option>';
    data.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        userRouteSelect.appendChild(opt);
    });
}

// --- Dashboard Cobrador ---
async function loadCollectorDashboard() {
    if (userRole !== 'cobrador') return;
    // ... (Lógica futura del cobrador)
}

// ===================================================
// INICIALIZACIÓN
// ===================================================
window.loadClients = loadClients;
window.loadLoans = loadLoans;
window.loadRoutesTable = loadRoutesTable;
window.loadUsersTable = loadUsersTable;
window.loadAdminDashboard = loadAdminDashboard;
window.loadReportsDashboard = loadReportsDashboard;
window.loadCollectorDashboard = loadCollectorDashboard;

document.addEventListener('DOMContentLoaded', () => {
    // Asignar Selectores
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
    
    clientsTableBody = document.getElementById('clients-table-body');
    clientModal = document.getElementById('client-modal');
    clientForm = document.getElementById('client-form');
    closeClientModalBtn = document.getElementById('close-client-modal-btn');
    openClientModalBtn = document.getElementById('open-client-modal-btn');
    cancelClientModalBtn = document.getElementById('cancel-client-modal-btn');
    clientIdInput = document.getElementById('client_id');
    routeSelect = document.getElementById('route_id');
    clientSearchInput = document.getElementById('client-search-input');

    loansTableBody = document.getElementById('loans-table-body');
    loanModal = document.getElementById('loan-modal');
    loanForm = document.getElementById('loan-form');
    closeLoanModalBtn = document.getElementById('close-loan-modal-btn');
    openLoanModalBtn = document.getElementById('open-loan-modal-btn');
    cancelLoanModalBtn = document.getElementById('cancel-loan-modal-btn');
    loanModalTitle = document.getElementById('loan-modal-title');
    loanClientIdSelect = document.getElementById('loan_client_id');
    loanCalcResults = document.getElementById('loan-calc-results');
    loanIdInput = document.getElementById('loan_id');
    loanClientSearchInput = document.getElementById('loan_client_search');

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
    
    routesTableBody = document.getElementById('routes-table-body');
    routeModal = document.getElementById('route-modal');
    routeForm = document.getElementById('route-form');
    closeRouteModalBtn = document.getElementById('close-route-modal-btn');
    cancelRouteModalBtn = document.getElementById('cancel-route-modal-btn');
    openRouteModalBtn = document.getElementById('open-route-modal-btn');
    routeModalTitle = document.getElementById('route-modal-title');
    routeIdInput = document.getElementById('route_id_input');

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
    
    kpiTotalLoaned = document.getElementById('kpi-total-loaned');
    kpiTotalCollected = document.getElementById('kpi-total-collected');
    kpiInterestEarned = document.getElementById('kpi-interest-earned');
    kpiActiveLoans = document.getElementById('kpi-active-loans');
    reportsStatusTableBody = document.getElementById('reports-status-table-body');
    confirmationModal = document.getElementById('confirmation-modal');
    confirmText = document.getElementById('confirm-text');
    confirmButton = document.getElementById('confirm-button');
    cancelConfirmButton = document.getElementById('cancel-confirm-button');

    // --- Eventos ---
    if(loginForm) loginForm.addEventListener('submit', handleLogin);
    if(registerForm) registerForm.addEventListener('submit', handleRegister);
    if(logoutButton) logoutButton.addEventListener('click', handleLogout);

    // Clientes
    if(openClientModalBtn) openClientModalBtn.addEventListener('click', () => openClientModal(null));
    if(closeClientModalBtn) closeClientModalBtn.addEventListener('click', closeClientModal);
    if(cancelClientModalBtn) cancelClientModalBtn.addEventListener('click', closeClientModal);
    if(clientForm) clientForm.addEventListener('submit', handleClientSubmit);
    if(clientSearchInput) clientSearchInput.addEventListener('keyup', loadClients);

    // Préstamos
    if(openLoanModalBtn) openLoanModalBtn.addEventListener('click', () => { openLoanModal(null); loadClientsForDropdown(''); });
    if(closeLoanModalBtn) closeLoanModalBtn.addEventListener('click', closeLoanModal);
    if(cancelLoanModalBtn) cancelLoanModalBtn.addEventListener('click', closeLoanModal);
    if(loanForm) loanForm.addEventListener('submit', handleLoanSubmit);
    if(loanClientSearchInput) loanClientSearchInput.addEventListener('keyup', (e) => loadClientsForDropdown(e.target.value));
    
    // Calculadora
    ['amount', 'interest_rate', 'total_payments', 'term_type'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateLoanTotals);
    });

    // Pagos
    if(closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closePaymentModal);
    if(paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);

    // Rutas y Usuarios
    if(openRouteModalBtn) openRouteModalBtn.addEventListener('click', () => openRouteModal(null));
    if(closeRouteModalBtn) closeRouteModalBtn.addEventListener('click', closeRouteModal);
    if(cancelRouteModalBtn) cancelRouteModalBtn.addEventListener('click', closeRouteModal);
    if(routeForm) routeForm.addEventListener('submit', handleRouteSubmit);

    if(closeUserModalBtn) closeUserModalBtn.addEventListener('click', closeUserModal);
    if(cancelUserModalBtn) cancelUserModalBtn.addEventListener('click', closeUserModal);
    if(userForm) userForm.addEventListener('submit', handleUserSubmit);

    // Confirmación
    if(confirmButton) confirmButton.addEventListener('click', handleConfirm);
    if(cancelConfirmButton) cancelConfirmButton.addEventListener('click', closeConfirmationModal);

    // Auth Listener
    if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, session);
            updateUIBasedOnAuth(session);
        });
    }
});



