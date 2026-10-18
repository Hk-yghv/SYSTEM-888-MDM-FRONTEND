import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';

/**
 * Check if the user is a super admin / master admin with unrestricted global access.
 */
export const isMasterAdminUser = (reqOrUser = {}) => {
    const username = (
        reqOrUser.username ||
        reqOrUser.query?.username ||
        reqOrUser.body?.username ||
        reqOrUser.headers?.['x-username'] ||
        reqOrUser.user?.username ||
        ''
    ).trim();

    const role = (
        reqOrUser.role ||
        reqOrUser.userRole ||
        reqOrUser.query?.userRole ||
        reqOrUser.body?.userRole ||
        reqOrUser.headers?.['x-user-role'] ||
        reqOrUser.user?.role ||
        ''
    ).trim();

    const isImmutable = (
        reqOrUser.isImmutable === true ||
        reqOrUser.isImmutable === 'true' ||
        reqOrUser.query?.isImmutable === 'true' ||
        reqOrUser.body?.isImmutable === 'true' ||
        reqOrUser.user?.isImmutable === true
    );

    // Only master admins (@hakyonghouv or isImmutable: true) have global, unrestricted access.
    // Regular Administrators/Admins assigned to specific brands or sub-brands MUST adhere to their isolated scope.
    return (
        username === '@hakyonghouv' ||
        username === 'hakyonghouv' ||
        isImmutable === true
    );
};

/**
 * Resolves user's Brand and allowed Sub-Brands from request and database.
 * If user is non-master, enforces brand and subBrand isolation strictly.
 */
export const resolveUserIsolation = async (req) => {
    const isMaster = isMasterAdminUser(req);
    const username = (
        req.query?.username ||
        req.body?.username ||
        req.headers?.['x-username'] ||
        req.user?.username ||
        ''
    ).trim();

    let brand = (
        req.query?.userBrand ||
        req.body?.userBrand ||
        req.query?.brand ||
        req.body?.brand ||
        req.headers?.['x-user-brand'] ||
        req.user?.brand ||
        ''
    ).trim();

    let subBrands = [];

    // 1. Query or Body param userSubBrands (comma-separated or array)
    const rawSubBrands = req.query?.userSubBrands || req.body?.userSubBrands || req.query?.subBrands || req.body?.subBrands;
    if (Array.isArray(rawSubBrands) && rawSubBrands.length > 0) {
        subBrands = rawSubBrands.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof rawSubBrands === 'string' && rawSubBrands.trim()) {
        subBrands = rawSubBrands.split(',').map(s => s.trim()).filter(Boolean);
    }

    // 2. Fallback to req.user if set by auth middleware
    if (subBrands.length === 0 && Array.isArray(req.user?.subBrands) && req.user.subBrands.length > 0) {
        subBrands = req.user.subBrands.map(s => String(s).trim()).filter(Boolean);
    }

    // 3. Fallback: Lookup user document from MongoDB or MEM_DB to enforce isolation even if frontend didn't supply subBrands
    if (username && (!brand || subBrands.length === 0)) {
        try {
            if (isMongoConnected) {
                const results = await queryAllDBs(User, M => M.findOne({ username }).select('brand subBrands'));
                const dbUser = Array.isArray(results) ? results.find(Boolean) : results;
                if (dbUser) {
                    if (!brand && dbUser.brand) brand = dbUser.brand.trim();
                    if (subBrands.length === 0 && Array.isArray(dbUser.subBrands) && dbUser.subBrands.length > 0) {
                        subBrands = dbUser.subBrands.map(s => String(s).trim()).filter(Boolean);
                    }
                }
            } else if (Array.isArray(MEM_DB.users)) {
                const memUser = MEM_DB.users.find(u => u.username === username);
                if (memUser) {
                    if (!brand && memUser.brand) brand = memUser.brand.trim();
                    if (subBrands.length === 0 && Array.isArray(memUser.subBrands) && memUser.subBrands.length > 0) {
                        subBrands = memUser.subBrands.map(s => String(s).trim()).filter(Boolean);
                    }
                }
            }
        } catch (err) {
            console.warn('[resolveUserIsolation] Lookup error:', err.message);
        }
    }

    const hasSubBrandRestriction = !isMaster && subBrands.length > 0;
    const requestedSubBrand = (req.query?.subBrand || req.body?.subBrand || '').trim();

    let effectiveSubBrands = subBrands;
    if (requestedSubBrand && requestedSubBrand !== 'All') {
        if (hasSubBrandRestriction) {
            if (subBrands.includes(requestedSubBrand)) {
                effectiveSubBrands = [requestedSubBrand];
            } else {
                effectiveSubBrands = ['__UNAUTHORIZED__'];
            }
        } else {
            effectiveSubBrands = [requestedSubBrand];
        }
    }

    return {
        isMasterAdmin: isMaster,
        username,
        brand,
        allowedSubBrands: subBrands,
        requestedSubBrand,
        effectiveSubBrands,
        hasSubBrandRestriction: hasSubBrandRestriction || (!isMaster && effectiveSubBrands.length > 0)
    };
};

/**
 * Applies brand and subBrand constraints directly to a MongoDB query filter object.
 */
export const applyIsolationFilter = (filter = {}, isolation = {}, { includeUnassignedSubBrand = false } = {}) => {
    const { isMasterAdmin, brand, effectiveSubBrands, hasSubBrandRestriction } = isolation;

    if (!isMasterAdmin) {
        if (brand) {
            filter.brand = { $regex: new RegExp(`^${brand.trim()}$`, 'i') };
        }
        if (hasSubBrandRestriction && effectiveSubBrands && effectiveSubBrands.length > 0) {
            const canIncludeUnassigned = includeUnassignedSubBrand &&
                !effectiveSubBrands.includes('__UNAUTHORIZED__');
            filter.subBrand = {
                $in: canIncludeUnassigned
                    ? [...effectiveSubBrands, '', null]
                    : effectiveSubBrands
            };
        }
    }

    return filter;
};

/**
 * Filters an array of in-memory objects according to isolation rules.
 */
export const filterInMemoryRecords = (records = [], isolation = {}, { includeUnassignedSubBrand = false } = {}) => {
    const { isMasterAdmin, brand, effectiveSubBrands, hasSubBrandRestriction } = isolation;
    if (isMasterAdmin) return records;

    const brandLower = (brand || '').trim().toLowerCase();

    return records.filter(item => {
        // 1. Brand match
        if (brandLower) {
            const itemBrand = (item.brand || '').trim().toLowerCase();
            if (itemBrand !== brandLower) return false;
        }

        // 2. Sub-brand match
        if (hasSubBrandRestriction && effectiveSubBrands && effectiveSubBrands.length > 0) {
            const itemSub = (item.subBrand || '').trim();
            const canIncludeUnassigned = includeUnassignedSubBrand &&
                !effectiveSubBrands.includes('__UNAUTHORIZED__');
            if (itemSub ? !effectiveSubBrands.includes(itemSub) : !canIncludeUnassigned) return false;
        }

        return true;
    });
};
