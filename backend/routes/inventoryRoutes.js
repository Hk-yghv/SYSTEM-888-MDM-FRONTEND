import express from 'express';
import InventoryItem from '../models/InventoryItem.js';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';

const router = express.Router();
const INVENTORY_LOCATIONS = new Set(['sen-sok', 'chbar-ampov', 'stueng-mean-chey']);

if (!Array.isArray(MEM_DB.inventoryItems)) MEM_DB.inventoryItems = [];

const getPermissionPath = (location) => `/inventory/${location}`;

const getRequestIdentity = async (req) => {
    const username = req.user?.username;
    if (!username) return null;

    const users = isMongoConnected
        ? await queryAllDBs(User, (Model) => Model.find({ username }).limit(1))
        : MEM_DB.users.filter((user) => user.username === username);
    const user = users[0];
    if (!user) return null;

    const permissions = user.permissions instanceof Map
        ? Object.fromEntries(user.permissions)
        : user.permissions || {};

    return {
        username: user.username,
        role: user.role || '',
        isImmutable: Boolean(user.isImmutable),
        permissions
    };
};

const isMasterAdmin = (identity) => (
    identity.username === '@hakyonghouv' ||
    identity.username === 'hakyonghouv' ||
    identity.isImmutable ||
    identity.role === 'Administrator' ||
    identity.role === 'Admin'
);

const hasInventoryPermission = (identity, location, action) => (
    isMasterAdmin(identity) || identity.permissions[getPermissionPath(location)]?.[action] === true
);

const validateLocation = (location, res) => {
    if (!INVENTORY_LOCATIONS.has(location)) {
        res.status(400).json({ success: false, message: 'A valid inventory location is required.' });
        return false;
    }
    return true;
};

const getItemById = async (id) => {
    if (isMongoConnected) {
        const items = await queryAllDBs(InventoryItem, (Model) => Model.find({ _id: id }).limit(1));
        return items[0] || null;
    }
    return MEM_DB.inventoryItems.find((item) => item._id === id) || null;
};

router.get('/:location', async (req, res) => {
    try {
        const { location } = req.params;
        if (!validateLocation(location, res)) return;
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ success: false, message: 'Authenticated user not found.' });
        if (!hasInventoryPermission(identity, location, 'read')) {
            return res.status(403).json({ success: false, message: 'Inventory read permission required.' });
        }

        const items = isMongoConnected
            ? await queryAllDBs(InventoryItem, (Model) => Model.find({ location }).sort({ createdAt: -1 }).lean())
            : MEM_DB.inventoryItems
                .filter((item) => item.location === location)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/:location', async (req, res) => {
    try {
        const { location } = req.params;
        if (!validateLocation(location, res)) return;
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ success: false, message: 'Authenticated user not found.' });
        if (!hasInventoryPermission(identity, location, 'create')) {
            return res.status(403).json({ success: false, message: 'Inventory create permission required.' });
        }

        const assetName = String(req.body.assetName || '').trim();
        const imageUrl = String(req.body.imageUrl || '').trim();
        const quantity = Number(req.body.quantity);
        const isAllowedImage = /^(https?:\/\/|data:image\/(?:jpeg|png|webp|gif);base64,)/i.test(imageUrl);
        if (!assetName || assetName.length > 160) {
            return res.status(400).json({ success: false, message: 'Asset name is required and must be 160 characters or fewer.' });
        }
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000000) {
            return res.status(400).json({ success: false, message: 'Quantity must be a positive whole number.' });
        }
        if (!isAllowedImage || imageUrl.length > 5000) {
            return res.status(400).json({ success: false, message: 'A valid image URL is required.' });
        }

        const itemData = {
            location,
            assetName,
            quantity,
            imageUrl,
            createdBy: identity.username,
            updatedBy: identity.username
        };
        let item;
        if (isMongoConnected) {
            const InventoryWrite = getWriteModel(InventoryItem) || InventoryItem;
            item = await InventoryWrite.create(itemData);
        } else {
            item = {
                ...itemData,
                _id: `inventory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            MEM_DB.inventoryItems.push(item);
        }

        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('Error saving inventory item:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/:location/:id', async (req, res) => {
    try {
        const { location, id } = req.params;
        if (!validateLocation(location, res)) return;
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ success: false, message: 'Authenticated user not found.' });
        if (!hasInventoryPermission(identity, location, 'edit')) {
            return res.status(403).json({ success: false, message: 'Inventory edit permission required.' });
        }

        const existingItem = await getItemById(id);
        if (!existingItem || existingItem.location !== location) {
            return res.status(404).json({ success: false, message: 'Inventory item not found.' });
        }

        const assetName = String(req.body.assetName || '').trim();
        const imageUrl = String(req.body.imageUrl || existingItem.imageUrl || '').trim();
        const quantity = Number(req.body.quantity);
        const isAllowedImage = /^(https?:\/\/|data:image\/(?:jpeg|png|webp|gif);base64,)/i.test(imageUrl);
        if (!assetName || assetName.length > 160) {
            return res.status(400).json({ success: false, message: 'Asset name is required and must be 160 characters or fewer.' });
        }
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000000) {
            return res.status(400).json({ success: false, message: 'Quantity must be a positive whole number.' });
        }
        if (!isAllowedImage || imageUrl.length > 5000) {
            return res.status(400).json({ success: false, message: 'A valid image URL is required.' });
        }

        const updates = {
            assetName,
            quantity,
            imageUrl,
            updatedBy: identity.username
        };
        let item;
        if (isMongoConnected) {
            const InventoryWrite = getWriteModel(InventoryItem) || InventoryItem;
            item = await InventoryWrite.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        } else {
            item = MEM_DB.inventoryItems.find((entry) => entry._id === id);
            Object.assign(item, updates, { updatedAt: new Date() });
        }

        res.json({ success: true, data: item });
    } catch (error) {
        console.error('Error updating inventory item:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/:location/:id', async (req, res) => {
    try {
        const { location, id } = req.params;
        if (!validateLocation(location, res)) return;
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ success: false, message: 'Authenticated user not found.' });
        if (!hasInventoryPermission(identity, location, 'delete')) {
            return res.status(403).json({ success: false, message: 'Inventory delete permission required.' });
        }

        const item = await getItemById(id);
        if (!item || item.location !== location) {
            return res.status(404).json({ success: false, message: 'Inventory item not found.' });
        }

        if (isMongoConnected) {
            const InventoryWrite = getWriteModel(InventoryItem) || InventoryItem;
            await InventoryWrite.findByIdAndDelete(id);
        } else {
            MEM_DB.inventoryItems = MEM_DB.inventoryItems.filter((entry) => entry._id !== id);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
