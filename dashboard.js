import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Check authentication
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        document.getElementById('adminEmail').textContent = user.email;
        loadDashboardData();
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
});

// Generate random activation code
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed 0, O, 1, I to avoid confusion
    let code = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Load Dashboard Data
async function loadDashboardData() {
    await loadCodes();
    await loadDevices();
    await loadReports();
    updateStatistics();
}

// Load Codes
async function loadCodes() {
    try {
        const codesRef = collection(db, 'activationCodes');
        const codesSnap = await getDocs(query(codesRef, orderBy('createdAt', 'desc')));

        const tbody = document.getElementById('codesTableBody');
        tbody.innerHTML = '';

        if (codesSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">لا توجد أكواد بعد</td></tr>';
            return;
        }

        codesSnap.forEach((docSnap) => {
            const code = docSnap.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <code class="code-display">${code.code}</code>
                    <button class="btn-icon btn-copy" onclick="copyCode('${code.code}')" title="نسخ الكود">📋</button>
                </td>
                <td>${code.customerName || '-'}</td>
                <td>${code.customerLocation || '-'}</td>
                <td>${code.customerPhone || '-'}</td>
                <td>
                    <span class="badge ${code.versionType === 'online' ? 'badge-active' : 'badge-available'}" style="font-size: 0.8em;">
                        ${code.versionType === 'online' ? '🌐 أونلاين' : '💻 أوفلاين'}
                    </span>
                </td>
                <td><span class="badge ${code.isUsed ? 'badge-used' : 'badge-available'}">${code.isUsed ? 'مستخدم' : 'متاح'}</span></td>
                <td>${code.durationDays} يوم</td>
                <td>${code.activatedAt ? new Date(code.activatedAt.toDate()).toLocaleDateString('ar-EG') : '-'}</td>
                <td>
                    <button class="btn-icon btn-delete" onclick="deleteCode('${docSnap.id}', '${code.code}')" title="حذف">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading codes:', error);
    }
}

// Global devices data
let allDevicesData = [];
let currentFilter = 'all';
let currentSort = 'activatedAt-desc';
let searchQuery = '';

// Load Devices
async function loadDevices() {
    try {
        const devicesRef = collection(db, 'activatedDevices');
        const devicesSnap = await getDocs(query(devicesRef, orderBy('activatedAt', 'desc')));

        const tbody = document.getElementById('devicesTableBody');
        tbody.innerHTML = '';

        if (devicesSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">لا توجد أجهزة مفعلة</td></tr>';
            updateDevicesStats([]);
            return;
        }

        // Store all devices data
        allDevicesData = [];
        devicesSnap.forEach((docSnap) => {
            const device = docSnap.data();
            const now = new Date();
            const expiresAt = device.expiresAt?.toDate();
            const isExpired = expiresAt < now;
            const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

            allDevicesData.push({
                id: docSnap.id,
                ...device,
                expiresAt,
                isExpired,
                daysLeft
            });
        });

        // Apply filter, search, and sort
        filterAndDisplayDevices();
        updateDevicesStats(allDevicesData);
    } catch (error) {
        console.error('Error loading devices:', error);
    }
}

// Filter and Display Devices
function filterAndDisplayDevices() {
    let filteredDevices = [...allDevicesData];

    // Apply search
    if (searchQuery) {
        filteredDevices = filteredDevices.filter(device =>
            device.deviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            device.activationCode?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    // Apply filter
    const now = new Date();
    if (currentFilter === 'active') {
        filteredDevices = filteredDevices.filter(d => d.isActive && !d.isExpired);
    } else if (currentFilter === 'stopped') {
        filteredDevices = filteredDevices.filter(d => !d.isActive);
    } else if (currentFilter === 'expired') {
        filteredDevices = filteredDevices.filter(d => d.isExpired);
    }

    // Apply sort
    const [sortField, sortDir] = currentSort.split('-');
    filteredDevices.sort((a, b) => {
        let valA, valB;

        if (sortField === 'deviceName') {
            valA = a.deviceName || '';
            valB = b.deviceName || '';
            return sortDir === 'asc' ? valA.localeCompare(valB, 'ar') : valB.localeCompare(valA, 'ar');
        } else if (sortField === 'daysLeft') {
            valA = a.daysLeft;
            valB = b.daysLeft;
        } else if (sortField === 'activatedAt') {
            valA = a.activatedAt?.toDate().getTime() || 0;
            valB = b.activatedAt?.toDate().getTime() || 0;
        } else if (sortField === 'expiresAt') {
            valA = a.expiresAt?.getTime() || 0;
            valB = b.expiresAt?.getTime() || 0;
        }

        return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    // Display devices
    const tbody = document.getElementById('devicesTableBody');
    tbody.innerHTML = '';

    if (filteredDevices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">لا توجد نتائج</td></tr>';
        return;
    }

    filteredDevices.forEach((device, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="device-checkbox" data-device-id="${device.id}" /></td>
            <td><strong>${index + 1}</strong></td>
            <td>${device.deviceName}</td>
            <td>
                <code class="code-display">${device.activationCode}</code>
                <button class="btn-icon btn-copy" onclick="copyCode('${device.activationCode}')" title="نسخ الكود">📋</button>
            </td>
            <td>${new Date(device.activatedAt.toDate()).toLocaleDateString('ar-EG')}</td>
            <td>${device.expiresAt.toLocaleDateString('ar-EG')}</td>
            <td>
                <span class="badge ${device.isActive && !device.isExpired ? 'badge-active' : device.isExpired ? 'badge-inactive' : 'badge-used'}">
                    ${device.isActive && !device.isExpired ? `✅ نشط (${device.daysLeft} يوم)` : device.isExpired ? '❌ منتهي' : '⏸️ متوقف'}
                </span>
            </td>
            <td>
                ${device.isActive && !device.isExpired ?
                `<button class="btn-icon btn-stop" onclick="stopDevice('${device.id}', '${device.deviceName}')" title="إيقاف السيستم">⏸️</button>` :
                `<button class="btn-icon btn-start" onclick="startDevice('${device.id}', '${device.deviceName}')" title="تشغيل السيستم">▶️</button>`
            }
                <button class="btn-icon btn-delete" onclick="deleteDevice('${device.id}', '${device.deviceName}')" title="مسح السيستم">🗑️</button>
                <button class="btn-icon btn-info" onclick="showDeviceDetails('${device.id}')" title="التفاصيل">ℹ️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Update checkbox listeners
    updateCheckboxListeners();
}

// Update Devices Stats
function updateDevicesStats(devices) {
    const now = new Date();
    const activeDevices = devices.filter(d => d.isActive && !d.isExpired);
    const stoppedDevices = devices.filter(d => !d.isActive && !d.isExpired);
    const expiredDevices = devices.filter(d => d.isExpired);

    const totalDaysLeft = activeDevices.reduce((sum, d) => sum + (d.daysLeft > 0 ? d.daysLeft : 0), 0);
    const avgDaysLeft = activeDevices.length > 0 ? Math.round(totalDaysLeft / activeDevices.length) : 0;

    document.getElementById('activeDevicesCount').textContent = activeDevices.length;
    document.getElementById('stoppedDevicesCount').textContent = stoppedDevices.length;
    document.getElementById('expiredDevicesCount').textContent = expiredDevices.length;
    document.getElementById('avgDaysLeft').textContent = avgDaysLeft;
}

// Update Statistics
async function updateStatistics() {
    try {
        const codesRef = collection(db, 'activationCodes');
        const devicesRef = collection(db, 'activatedDevices');

        const [codesSnap, devicesSnap] = await Promise.all([
            getDocs(codesRef),
            getDocs(devicesRef)
        ]);

        const totalCodes = codesSnap.size;
        const usedCodes = codesSnap.docs.filter(doc => doc.data().isUsed).length;
        const activeDevices = devicesSnap.docs.filter(doc => {
            const device = doc.data();
            const now = new Date();
            const expiresAt = device.expiresAt?.toDate();
            return device.isActive && expiresAt > now;
        }).length;

        document.getElementById('totalCodes').textContent = totalCodes;
        document.getElementById('usedCodes').textContent = usedCodes;
        document.getElementById('activeDevices').textContent = activeDevices;
        document.getElementById('availableCodes').textContent = totalCodes - usedCodes;
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// Generate Code Modal
const generateModal = document.getElementById('generateModal');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const confirmGenerateBtn = document.getElementById('confirmGenerateBtn');

generateCodeBtn?.addEventListener('click', () => {
    generateModal.style.display = 'flex';
});

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        generateModal.style.display = 'none';
    });
});

// Toggle Lifetime checkbox
document.getElementById('isLifetime')?.addEventListener('change', (e) => {
    const durationInput = document.getElementById('codeDuration');
    if (e.target.checked) {
        durationInput.disabled = true;
        durationInput.value = '';
        durationInput.placeholder = 'مدى الحياة';
    } else {
        durationInput.disabled = false;
        durationInput.value = '30';
    }
});

confirmGenerateBtn?.addEventListener('click', async () => {
    const isLifetime = document.getElementById('isLifetime').checked;
    const duration = isLifetime ? 99999 : parseInt(document.getElementById('codeDuration').value);
    const count = parseInt(document.getElementById('codeCount').value);
    const customerName = document.getElementById('customerName').value.trim();
    const customerLocation = document.getElementById('customerLocation').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const versionType = document.getElementById('versionType').value;

    // Validation
    if (!customerName || !customerLocation || !customerPhone) {
        alert('يرجى إدخال جميع بيانات العميل');
        return;
    }

    if (!isLifetime && (!duration || duration < 1)) {
        alert('يرجى رقم صحيح لمدة الاشتراك');
        return;
    }

    if (!count || count < 1) {
        alert('يرجى إدخال عدد صحيح للأكواد');
        return;
    }

    const btn = confirmGenerateBtn;
    btn.disabled = true;
    btn.textContent = 'جاري الإنشاء...';

    try {
        const codesRef = collection(db, 'activationCodes');
        const promises = [];

        for (let i = 0; i < count; i++) {
            // If lifetime, expire in year 2099
            // If normal, expire dynamically upon activation (logic handled on client/server activation)
            // But here we set 'durationDays' which is used to calculate expiry ON ACTIVATION.

            promises.push(addDoc(codesRef, {
                code: generateCode(),
                isUsed: false,
                deviceId: null,
                deviceName: null,
                activatedAt: null,
                expiresAt: null, // Will be set on activation
                durationDays: duration,
                isLifetime: isLifetime, // Allow frontend to know easily
                isActive: true,
                // Customer information
                customerName: customerName,
                customerLocation: customerLocation,
                customerPhone: customerPhone,
                versionType: versionType,
                createdAt: Timestamp.now()
            }));
        }

        await Promise.all(promises);

        // Log the action
        await logAction('إنشاء أكواد', `تم إنشاء ${count} كود (المدة: ${isLifetime ? 'مدى الحياة' : duration + ' يوم'})`, { count, duration, isLifetime });

        alert(`تم إنشاء ${count} كود بنجاح ✅`);
        generateModal.style.display = 'none';

        // Clear form fields
        document.getElementById('customerName').value = '';
        document.getElementById('customerLocation').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('codeDuration').value = '30';
        document.getElementById('codeCount').value = '1';

        await loadDashboardData();
    } catch (error) {
        console.error('Error generating codes:', error);
        alert('حدث خطأ أثناء إنشاء الأكواد');
    } finally {
        btn.disabled = false;
        btn.textContent = 'إنشاء';
    }
});

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(tab + 'Tab').classList.add('active');
    });
});

// Delete Code
window.deleteCode = async (codeId, code) => {
    if (!confirm(`هل أنت متأكد من حذف الكود ${code}؟`)) return;

    try {
        await deleteDoc(doc(db, 'activationCodes', codeId));
        await logAction('حذف كود', `تم حذف الكود: ${code}`, { codeId, code });
        alert('تم حذف الكود بنجاح');
        await loadDashboardData();
    } catch (error) {
        console.error('Error deleting code:', error);
        alert('حدث خطأ أثناء الحذف');
    }
};

// Stop Device (Deactivate)
window.stopDevice = async (deviceId, deviceName) => {
    if (!confirm(`هل أنت متأكد من إيقاف تفعيل ${deviceName}؟`)) return;

    try {
        await updateDoc(doc(db, 'activatedDevices', deviceId), {
            isActive: false
        });
        await logAction('إيقاف سيستم', `تم إيقاف جهاز: ${deviceName}`, { deviceId, deviceName });
        alert('تم إيقاف السيستم بنجاح ⏸️');
        await loadDashboardData();
    } catch (error) {
        console.error('Error stopping device:', error);
        alert('حدث خطأ أثناء إيقاف السيستم');
    }
};

// Start Device (Reactivate)
window.startDevice = async (deviceId, deviceName) => {
    if (!confirm(`هل أنت متأكد من تشغيل ${deviceName}؟`)) return;

    try {
        await updateDoc(doc(db, 'activatedDevices', deviceId), {
            isActive: true
        });
        await logAction('تشغيل سيستم', `تم تشغيل جهاز: ${deviceName}`, { deviceId, deviceName });
        alert('تم تشغيل السيستم بنجاح ▶️');
        await loadDashboardData();
    } catch (error) {
        console.error('Error starting device:', error);
        alert('حدث خطأ أثناء تشغيل السيستم');
    }
};

// Delete Device
window.deleteDevice = async (deviceId, deviceName) => {
    if (!confirm(`هل أنت متأكد من حذف ${deviceName}؟`)) return;

    try {
        await deleteDoc(doc(db, 'activatedDevices', deviceId));
        await logAction('حذف سيستم', `تم حذف جهاز: ${deviceName}`, { deviceId, deviceName });
        alert('تم حذف الجهاز بنجاح');
        await loadDashboardData();
    } catch (error) {
        console.error('Error deleting device:', error);
        alert('حدث خطأ أثناء الحذف');
    }
};

// Auto refresh every 30 seconds
setInterval(() => {
    loadDashboardData();
}, 30000);

// Load Reports
// Load Activity Logs (Reports)
async function loadReports() {
    try {
        const logsRef = collection(db, 'activityLogs');
        let q = query(logsRef, orderBy('timestamp', 'desc'));

        // Apply filters if set
        const dateFrom = document.getElementById('logDateFrom')?.value;
        const dateTo = document.getElementById('logDateTo')?.value;
        const adminFilter = document.getElementById('logAdminFilter')?.value.toLowerCase();
        const actionFilter = document.getElementById('logActionFilter')?.value;

        // Note: Client-side filtering for simplicity unless dataset is huge.
        // Firestore composite indexes would be needed for complex server-side filtering.

        const logsSnap = await getDocs(q);
        let logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter InMemory
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            logs = logs.filter(log => log.timestamp?.toDate() >= fromDate);
        }
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            logs = logs.filter(log => log.timestamp?.toDate() <= toDate);
        }
        if (adminFilter) {
            logs = logs.filter(log => log.adminEmail?.toLowerCase().includes(adminFilter));
        }
        if (actionFilter && actionFilter !== 'all') {
            logs = logs.filter(log => log.action === actionFilter);
        }

        const tbody = document.getElementById('reportsTableBody');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="no-data">لا توجد سجلات نشاط</td></tr>';
            return;
        }

        logs.forEach((log) => {
            const date = log.timestamp ? log.timestamp.toDate().toLocaleString('ar-EG') : '-';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="direction: ltr; text-align: right;">${date}</td>
                <td>${log.adminEmail || 'Unknown'}</td>
                <td><span class="badge badge-active">${log.action}</span></td>
                <td>${log.details}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading activity logs:', error);
        const tbody = document.getElementById('reportsTableBody');
        tbody.innerHTML = '<tr><td colspan="4" class="no-data" style="color: red;">خطأ في تحميل السجلات</td></tr>';
    }
}

// Apply Filters Listener
document.getElementById('applyLogFilters')?.addEventListener('click', loadReports);

// Navbar Scroll Effect - Jelly Animation
const navbar = document.querySelector('.navbar');
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    if (currentScrollY > 50) {
        if (!navbar.classList.contains('scrolled')) {
            navbar.classList.add('scrolled');
        }
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScrollY = currentScrollY;
});

// Export to CSV
document.getElementById('exportReportBtn')?.addEventListener('click', async () => {
    try {
        const codesRef = collection(db, 'activationCodes');
        const codesSnap = await getDocs(query(codesRef, orderBy('createdAt', 'desc')));

        let csv = '﻿اسم العميل,المكان,التليفون,الكود,المدة,تاريخ الإنشاء,تاريخ التفعيل,تاريخ الانتهاء,الحالة\n';

        codesSnap.forEach((docSnap) => {
            const code = docSnap.data();
            const status = code.isUsed ? (
                code.expiresAt && code.expiresAt.toDate() > new Date() ? 'نشط' : 'منتهي'
            ) : 'غير مفعل';

            csv += `${code.customerName || '-'},${code.customerLocation || '-'},${code.customerPhone || '-'},${code.code},${code.durationDays},`;
            csv += `${code.createdAt ? new Date(code.createdAt.toDate()).toLocaleDateString('ar-EG') : '-'},`;
            csv += `${code.activatedAt ? new Date(code.activatedAt.toDate()).toLocaleDateString('ar-EG') : '-'},`;
            csv += `${code.expiresAt ? new Date(code.expiresAt.toDate()).toLocaleDateString('ar-EG') : '-'},`;
            csv += `${status}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `activation_report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        alert('تم تصدير التقرير بنجاح ✅');
    } catch (error) {
        console.error('Error exporting report:', error);
        alert('حدث خطأ أثناء التصدير');
    }
});

// ========== DEVICES PAGE FEATURES ==========

// Search functionality
document.getElementById('devicesSearch')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    filterAndDisplayDevices();
});

// Filter functionality
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        filterAndDisplayDevices();
    });
});

// Sort functionality
document.getElementById('devicesSort')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    filterAndDisplayDevices();
});

// Checkbox functionality
function updateCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.device-checkbox');
    const selectAll = document.getElementById('selectAllDevices');
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');

    // Select all checkbox
    selectAll?.addEventListener('change', (e) => {
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBulkActionsBar();
    });

    // Individual checkboxes
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            updateBulkActionsBar();
        });
    });

    function updateBulkActionsBar() {
        const checked = document.querySelectorAll('.device-checkbox:checked');
        if (checked.length > 0) {
            bulkActionsBar.style.display = 'flex';
            selectedCount.textContent = checked.length;
        } else {
            bulkActionsBar.style.display = 'none';
        }
    }
}

// Get selected device IDs
function getSelectedDeviceIds() {
    const checked = document.querySelectorAll('.device-checkbox:checked');
    return Array.from(checked).map(cb => cb.dataset.deviceId);
}

// Bulk Start Devices
window.bulkStartDevices = async () => {
    const deviceIds = getSelectedDeviceIds();
    if (deviceIds.length === 0) return;

    if (!confirm(`هل أنت متأكد من تشغيل ${deviceIds.length} جهاز؟`)) return;

    try {
        const promises = deviceIds.map(id =>
            updateDoc(doc(db, 'activatedDevices', id), { isActive: true })
        );
        await Promise.all(promises);
        await logAction('تشغيل جماعي', `تم تشغيل ${deviceIds.length} جهاز`, { count: deviceIds.length, deviceIds });
        alert(`تم تشغيل ${deviceIds.length} جهاز بنجاح ▶️`);
        await loadDashboardData();
    } catch (error) {
        console.error('Error bulk starting devices:', error);
        alert('حدث خطأ أثناء تشغيل الأجهزة');
    }
};

// Bulk Stop Devices
window.bulkStopDevices = async () => {
    const deviceIds = getSelectedDeviceIds();
    if (deviceIds.length === 0) return;

    if (!confirm(`هل أنت متأكد من إيقاف ${deviceIds.length} جهاز؟`)) return;

    try {
        const promises = deviceIds.map(id =>
            updateDoc(doc(db, 'activatedDevices', id), { isActive: false })
        );
        await Promise.all(promises);
        await logAction('إيقاف جماعي', `تم إيقاف ${deviceIds.length} جهاز`, { count: deviceIds.length, deviceIds });
        alert(`تم إيقاف ${deviceIds.length} جهاز بنجاح ⏸️`);
        await loadDashboardData();
    } catch (error) {
        console.error('Error bulk stopping devices:', error);
        alert('حدث خطأ أثناء إيقاف الأجهزة');
    }
};

// Bulk Delete Devices
window.bulkDeleteDevices = async () => {
    const deviceIds = getSelectedDeviceIds();
    if (deviceIds.length === 0) return;

    if (!confirm(`⚠️ هل أنت متأكد من حذف ${deviceIds.length} جهاز نهائياً؟ هذا الإجراء لا يمكن التراجع عنه!`)) return;

    try {
        const promises = deviceIds.map(id =>
            deleteDoc(doc(db, 'activatedDevices', id))
        );
        await Promise.all(promises);
        await logAction('حذف جماعي', `تم حذف ${deviceIds.length} جهاز`, { count: deviceIds.length, deviceIds });
        alert(`تم حذف ${deviceIds.length} جهاز بنجاح 🗑️`);
        await loadDashboardData();
    } catch (error) {
        console.error('Error bulk deleting devices:', error);
        alert('حدث خطأ أثناء حذف الأجهزة');
    }
};

// Show Device Details
window.showDeviceDetails = (deviceId) => {
    const device = allDevicesData.find(d => d.id === deviceId);
    if (!device) return;

    const details = `
📱 اسم الجهاز: ${device.deviceName}
🔑 كود التفعيل: ${device.activationCode}
📅 تاريخ التفعيل: ${new Date(device.activatedAt.toDate()).toLocaleDateString('ar-EG')}
⏰ تاريخ الانتهاء: ${device.expiresAt.toLocaleDateString('ar-EG')}
📊 الأيام المتبقية: ${device.daysLeft > 0 ? device.daysLeft + ' يوم' : 'منتهي'}
✅ الحالة: ${device.isActive && !device.isExpired ? 'نشط' : device.isExpired ? 'منتهي' : 'متوقف'}

👤 معلومات العميل:
الاسم: ${device.customerName || '-'}
المكان: ${device.customerLocation || '-'}
التليفون: ${device.customerPhone || '-'}
    `;

    alert(details);
};

// Export Selected Devices
window.exportSelectedDevices = () => {
    const deviceIds = getSelectedDeviceIds();
    if (deviceIds.length === 0) {
        alert('يرجى تحديد أجهزة للتصدير');
        return;
    }

    const selectedDevices = allDevicesData.filter(d => deviceIds.includes(d.id));
    exportDevicesToCSV(selectedDevices, `selected_devices_${new Date().toISOString().split('T')[0]}.csv`);
};

// Export All Devices
window.exportAllDevices = () => {
    if (allDevicesData.length === 0) {
        alert('لا توجد أجهزة للتصدير');
        return;
    }

    exportDevicesToCSV(allDevicesData, `all_devices_${new Date().toISOString().split('T')[0]}.csv`);
};

// Export Devices to CSV
function exportDevicesToCSV(devices, filename) {
    let csv = '﻿اسم الجهاز,كود التفعيل,تاريخ التفعيل,تاريخ الانتهاء,الأيام المتبقية,الحالة,اسم العميل,المكان,التليفون\n';

    devices.forEach((device) => {
        const status = device.isActive && !device.isExpired ? 'نشط' : device.isExpired ? 'منتهي' : 'متوقف';
        csv += `${device.deviceName},${device.activationCode},`;
        csv += `${new Date(device.activatedAt.toDate()).toLocaleDateString('ar-EG')},`;
        csv += `${device.expiresAt.toLocaleDateString('ar-EG')},`;
        csv += `${device.daysLeft > 0 ? device.daysLeft : 0},${status},`;
        csv += `${device.customerName || '-'},${device.customerLocation || '-'},${device.customerPhone || '-'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    alert(`تم تصدير ${devices.length} جهاز بنجاح ✅`);
}

// Copy Code to Clipboard
window.copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
        // Show a temporary tooltip or notification
        alert('تم نسخ الكود بنجاح! 📋');
    }).catch(err => {
        console.error('Error copying text: ', err);
        alert('حدث خطأ أثناء نسخ الكود');
    });
};

// Log Action Helper
async function logAction(action, details = '', metadata = {}) {
    try {
        const adminEmail = auth.currentUser ? auth.currentUser.email : 'Unknown';
        await addDoc(collection(db, 'activityLogs'), {
            action: action,
            adminEmail: adminEmail,
            details: details,
            metadata: metadata,
            timestamp: Timestamp.now()
        });
    } catch (error) {
        console.error('Error logging action:', error);
    }
}


// Fix Device Names (Sequential Renaming)
window.fixDeviceNames = async () => {
    if (!confirm('هل أنت متأكد من إعادة تسمية جميع الأجهزة وتسلسلها (Device 1, Device 2...) حسب تاريخ التفعيل؟')) return;

    try {
        const devicesRef = collection(db, 'activatedDevices');
        // Get all devices ordered by activation date (oldest first)
        const q = query(devicesRef, orderBy('activatedAt', 'asc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert('لا توجد أجهزة لتحديثها');
            return;
        }

        const promises = [];
        let index = 1;

        querySnapshot.forEach((docSnap) => {
            const newName = `Device ${index}`;
            promises.push(updateDoc(doc(db, 'activatedDevices', docSnap.id), {
                deviceName: newName
            }));
            index++;
        });

        await Promise.all(promises);

        // Log the action
        await logAction('تصحيح أسماء', `تم تحديث أسماء ${promises.length} جهاز`, { count: promises.length });

        alert(`تم تحديث أسماء ${promises.length} جهاز بنجاح ✅`);
        await loadDashboardData();
    } catch (error) {
        console.error('Error fixing device names:', error);
        alert('حدث خطأ أثناء تحديث الأسماء');
    }
};

window.logAction = logAction; // Expose globally
