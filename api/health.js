import { isConfigured } from '../lib/auth.js';
import { isStorageConfigured } from '../lib/storage.js';
export default function handler(req,res){res.setHeader('Cache-Control','no-store');res.status(200).json({service:'Tagihan Bulanan',authReady:isConfigured(),storageReady:isStorageConfigured(),backend:'Private Google Drive via Apps Script',timestamp:new Date().toISOString()});}
