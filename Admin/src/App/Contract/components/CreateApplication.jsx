import React, { useState, useEffect } from 'react';
import { FaAngleDoubleRight } from "react-icons/fa";
import { useAuth } from '../../../context/AuthContext';

const CreateApplication = ({ open, setOpen, editData, onSaved }) => {
    const { API_BASE, user } = useAuth();

    const [form, setForm] = useState({
        customerNameEn: '',
        customerNameKh: '',
        idCardNumber: '',
        dob: '',
        gender: 'male',
        birthAddress: '',
        currentAddress: '',
        phone: '',
        relativePhone: '',
        facebookName: '',
        telegramName: '',
        urlFb: '',
        customerPhoto: '',
        googleDrivePhotoUrl: '',

        model: '',
        serialNumber: '',
        imei1: '',
        imei2: '',
        color: '',
        version: '',

        amount: 1000,
        interest: '14%',
        adminFee: 20,
        duration: '12 Months',
        interestType: '14%',
        monthlyPayment: 100
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (editData) {
            setForm({
                customerNameEn: editData.customerNameEn || editData.name_english || '',
                customerNameKh: editData.customerNameKh || editData.name_khmer || '',
                idCardNumber: editData.idCardNumber || editData.id_number || '',
                dob: editData.dob || '',
                gender: editData.gender || 'male',
                birthAddress: editData.birthAddress || editData.birth_address || '',
                currentAddress: editData.currentAddress || editData.current_address || '',
                phone: editData.phone || editData.phone_number || '',
                relativePhone: editData.relativePhone || editData.friend_or_relative_phone_number || '',
                facebookName: editData.facebookName || editData.facebook_name || '',
                telegramName: editData.telegramName || editData.telegram_name || '',
                urlFb: editData.urlFb || editData.url_fb || '',
                customerPhoto: editData.customerPhoto || '',
                googleDrivePhotoUrl: editData.googleDrivePhotoUrl || '',

                model: editData.model || editData.device_model || '',
                serialNumber: editData.serialNumber || editData.serial_number || '',
                imei1: editData.imei1 || editData.imei1_number || '',
                imei2: editData.imei2 || editData.imei2_number || '',
                color: editData.color || '',
                version: editData.version || '',

                amount: editData.amount || editData.totalAmount || 1000,
                interest: editData.interest || '14%',
                adminFee: editData.adminFee || 20,
                duration: editData.duration || '12 Months',
                interestType: editData.interestType || '14%',
                monthlyPayment: editData.monthlyPayment || 100
            });
        }
    }, [editData]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setForm(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const isAdmin = user?.role === 'Administrator' || user?.username === '@hakyonghouv';

        const payload = {
            ...form,
            customerPhoto: form.googleDrivePhotoUrl || form.customerPhoto,
            inputDate: editData?.inputDate || new Date().toISOString().split('T')[0],
            status: editData?.status || 'Application',
            monthlyPayment: Number(form.monthlyPayment) || (Number(form.amount) / 10),
            modifiedByAdmin: isAdmin ? true : Boolean(editData?.modifiedByAdmin),
            lastModifiedBy: isAdmin ? (user?.name || 'BOY BOY (Administrator)') : (editData?.lastModifiedBy || '')
        };

        try {
            const url = editData ? `${API_BASE}/contracts/${editData._id}` : `${API_BASE}/contracts`;
            const method = editData ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            setSubmitting(false);

            if (res.ok) {
                setOpen(false);
                if (onSaved) onSaved();
            } else {
                alert('Failed to save contract');
            }
        } catch (err) {
            setSubmitting(false);
            console.error('Save contract error:', err);
        }
    };

    if (!open) return null;

    return (
        <div className="w-[calc(100%-260px)] h-[87vh] overflow-auto absolute right-0 top-[7vh] bg-gray-900 border border-gray-700 z-[99999] shadow-2xl p-4">
            <form onSubmit={handleSubmit}>
                <div className='flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 rounded-t-2xl'>
                    <div>
                        <h3 className='text-lg font-bold text-gray-100'>
                            {editData ? 'Edit Application Contract' : 'Create Application Contract'}
                        </h3>
                        <p className='text-xs text-gray-400'>Enter Customer, Device, and Loan Information to store in MongoDB</p>
                    </div>
                    <div className='flex gap-3'>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className='px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs cursor-pointer'
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className='px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-600/30'
                        >
                            {submitting ? 'Saving...' : 'Submit to MongoDB'}
                        </button>
                    </div>
                </div>

                <div className='p-4 w-full h-[75vh] overflow-y-auto space-y-6 text-xs text-gray-200'>

                    {/* Section 1: Customer Information */}
                    <div>
                        <h2 className='flex items-center gap-2 text-sm font-bold text-indigo-400 mb-2'>
                            <FaAngleDoubleRight /> Customer Information
                        </h2>
                        <hr className='border-gray-800 mb-4' />

                        <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="customerNameEn" className="font-semibold text-gray-400">Name English</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="customerNameEn" value={form.customerNameEn} onChange={handleChange} required placeholder="Name English" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="customerNameKh" className="font-semibold text-gray-400">Name Khmer</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-khmer" type="text" id="customerNameKh" value={form.customerNameKh} onChange={handleChange} required placeholder="Name Khmer" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="idCardNumber" className="font-semibold text-gray-400">ID Number</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="text" id="idCardNumber" value={form.idCardNumber} onChange={handleChange} placeholder="Id number" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="dob" className="font-semibold text-gray-400">Date of Birth</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="date" id="dob" value={form.dob} onChange={handleChange} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="gender" className="font-semibold text-gray-400">Gender</label>
                                <select className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" id="gender" value={form.gender} onChange={handleChange}>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="birthAddress" className="font-semibold text-gray-400">Birth Address</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="birthAddress" value={form.birthAddress} onChange={handleChange} placeholder="Birth address" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="currentAddress" className="font-semibold text-gray-400">Current Address</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="currentAddress" value={form.currentAddress} onChange={handleChange} placeholder="Current address" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="phone" className="font-semibold text-gray-400">Phone Number</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="text" id="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="relativePhone" className="font-semibold text-gray-400">Relative Phone Number</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="text" id="relativePhone" value={form.relativePhone} onChange={handleChange} placeholder="Relative phone number" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="facebookName" className="font-semibold text-gray-400">Facebook Name</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="facebookName" value={form.facebookName} onChange={handleChange} placeholder="Facebook Name" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="telegramName" className="font-semibold text-gray-400">Telegram Name</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="telegramName" value={form.telegramName} onChange={handleChange} placeholder="Telegram Name" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="urlFb" className="font-semibold text-gray-400">URL Facebook</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="urlFb" value={form.urlFb} onChange={handleChange} placeholder="URL Facebook" />
                            </div>
                            <div className="flex flex-col gap-1 col-span-2">
                                <label htmlFor="googleDrivePhotoUrl" className="font-semibold text-amber-400">Photo URL (Google Drive / Image Link)</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-amber-600/50 rounded-xl text-gray-100 font-mono text-xs" type="text" id="googleDrivePhotoUrl" value={form.googleDrivePhotoUrl} onChange={handleChange} placeholder="https://drive.google.com/uc?export=view&id=... or Image URL" />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Device Information */}
                    <div>
                        <h2 className='flex items-center gap-2 text-sm font-bold text-purple-400 mb-2'>
                            <FaAngleDoubleRight /> Device Information
                        </h2>
                        <hr className='border-gray-800 mb-4' />

                        <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="model" className="font-semibold text-gray-400">Device Model</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="model" value={form.model} onChange={handleChange} required placeholder="Device Model" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="serialNumber" className="font-semibold text-gray-400">Serial Number</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="text" id="serialNumber" value={form.serialNumber} onChange={handleChange} required placeholder="Serial Number" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="imei1" className="font-semibold text-gray-400">IMEI1 Number</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="text" id="imei1" value={form.imei1} onChange={handleChange} placeholder="IMEI1 Number" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="imei2" className="font-semibold text-gray-400">IMEI2 Number</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="text" id="imei2" value={form.imei2} onChange={handleChange} placeholder="IMEI2 Number" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="color" className="font-semibold text-gray-400">Color</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="color" value={form.color} onChange={handleChange} placeholder="Color" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="version" className="font-semibold text-gray-400">Version</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="version" value={form.version} onChange={handleChange} placeholder="Version" />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Loan Information */}
                    <div>
                        <h2 className='flex items-center gap-2 text-sm font-bold text-emerald-400 mb-2'>
                            <FaAngleDoubleRight /> Loan & Financial Terms
                        </h2>
                        <hr className='border-gray-800 mb-4' />

                        <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="amount" className="font-semibold text-gray-400">Total Amount ($ USD)</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-emerald-400 font-bold font-mono" type="number" id="amount" value={form.amount} onChange={handleChange} placeholder="Amount" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="monthlyPayment" className="font-semibold text-gray-400">Monthly Installment ($ USD)</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-emerald-400 font-bold font-mono" type="number" id="monthlyPayment" value={form.monthlyPayment} onChange={handleChange} placeholder="Monthly Payment" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="interest" className="font-semibold text-gray-400">Interest Rate</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono" type="text" id="interest" value={form.interest} onChange={handleChange} placeholder="Interest" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="duration" className="font-semibold text-gray-400">Duration</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100" type="text" id="duration" value={form.duration} onChange={handleChange} placeholder="Duration" />
                            </div>
                        </div>
                    </div>

                </div>
            </form>
        </div>
    );
};

export default CreateApplication;