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
