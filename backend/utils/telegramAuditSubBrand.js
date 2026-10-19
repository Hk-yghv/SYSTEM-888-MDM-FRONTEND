import Contract from '../models/Contract.js';
import { TelegramAuditContact, TelegramAuditLog, TelegramAuditSubmission } from '../models/TelegramAudit.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { dbInstances } from '../config/multiDB.js';

const bindModel = (instance, baseModel) => {
    try {
        return instance.conn.model(baseModel.modelName);
    } catch {
        return instance.conn.model(baseModel.modelName, baseModel.schema);
    }
};

const emptySubBrandFilter = {
    $or: [
        { subBrand: { $exists: false } },
        { subBrand: '' },
        { subBrand: null }
    ]
};

const emptyBrandFilter = {
    $or: [
        { brand: { $exists: false } },
        { brand: '' },
        { brand: null }
    ]
};

export const backfillTelegramAuditSubBrand = async (brand, subBrand) => {
    const normalizedBrand = String(brand || '').trim();
    const normalizedSubBrand = String(subBrand || '').trim();
    if (!normalizedBrand || !normalizedSubBrand) return 0;

    const brandRegex = new RegExp(`^${normalizedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    let updatedCount = 0;

    if (isMongoConnected) {
        for (const instance of dbInstances) {
            if (instance.status !== 'connected' || !instance.conn) continue;

            let contractIds = [];
            try {
                const ContractModel = bindModel(instance, Contract);
                const contracts = await ContractModel.find({ brand: brandRegex })
                    .select('_id contractId contractIid')
                    .lean();
                contractIds = [...new Set(contracts.flatMap(contract => [
                    contract._id,
                    contract.contractId,
                    contract.contractIid
                ].filter(Boolean).map(String)))];
            } catch (error) {
                console.warn(`[TelegramAuditSubBrand] Contract lookup failed on ${instance.name}:`, error.message);
            }

            for (const model of [TelegramAuditContact, TelegramAuditLog]) {
                try {
                    const BoundModel = bindModel(instance, model);
                    const brandConditions = [
                        { brand: brandRegex },
                        ...(contractIds.length > 0
                            ? [{ $and: [emptyBrandFilter, { contractId: { $in: contractIds } }] }]
                            : [])
                    ];
                    const result = await BoundModel.updateMany(
                        {
                            $and: [
                                emptySubBrandFilter,
                                { $or: brandConditions }
                            ]
                        },
                        { $set: { brand: normalizedBrand, subBrand: normalizedSubBrand } }
                    );
                    updatedCount += result.modifiedCount || 0;
                } catch (error) {
                    console.warn(`[TelegramAuditSubBrand] ${model.modelName} backfill failed on ${instance.name}:`, error.message);
                }
            }

            try {
                const SubmissionModel = bindModel(instance, TelegramAuditSubmission);
                const submissionResult = await SubmissionModel.updateMany(
                    { brand: brandRegex, ...emptySubBrandFilter },
                    { $set: { brand: normalizedBrand, subBrand: normalizedSubBrand } }
                );
                updatedCount += submissionResult.modifiedCount || 0;
            } catch (error) {
                console.warn(`[TelegramAuditSubBrand] TelegramAuditSubmission backfill failed on ${instance.name}:`, error.message);
            }
        }
    }

    const memoryContracts = (MEM_DB.contracts || []).filter(
        contract => String(contract.brand || '').trim().toLowerCase() === normalizedBrand.toLowerCase()
    );
    const memoryContractIds = new Set(memoryContracts.flatMap(contract => [
        contract._id,
        contract.contractId,
        contract.contractIid
    ].filter(Boolean).map(String)));

    for (const collection of [MEM_DB.telegramAuditContacts, MEM_DB.telegramAuditLogs]) {
        if (!Array.isArray(collection)) continue;
        collection.forEach(record => {
            const recordBrand = String(record.brand || '').trim();
            const brandMatches = recordBrand.toLowerCase() === normalizedBrand.toLowerCase();
            const contractMatches = !recordBrand && memoryContractIds.has(String(record.contractId || ''));
            if ((!record.subBrand || record.subBrand === '') && (brandMatches || contractMatches)) {
                record.brand = normalizedBrand;
                record.subBrand = normalizedSubBrand;
                updatedCount++;
            }
        });
    }

    if (Array.isArray(MEM_DB.telegramAuditSubmissions)) {
        MEM_DB.telegramAuditSubmissions.forEach(record => {
            if (
                String(record.brand || '').trim().toLowerCase() === normalizedBrand.toLowerCase() &&
                (!record.subBrand || record.subBrand === '')
            ) {
                record.brand = normalizedBrand;
                record.subBrand = normalizedSubBrand;
                updatedCount++;
            }
        });
    }

    return updatedCount;
};
