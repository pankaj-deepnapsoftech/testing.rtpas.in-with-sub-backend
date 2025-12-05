const express = require('express');
const { summary,salesData,dispatchData,financialSummary, dashboardWithFilter, getMonthlySalesAndDelivered,machineStatus,getAllMachines,getProductionDashboard,getMachineData, getWelcomeMessage,productionChart,accountantDashboard } = require('../controllers/dashboard');
const { isAuthenticated } = require('../middlewares/isAuthenticated');
const { isSuper } = require('../middlewares/isSuper');
const { getStats } = require('../controllers/stats');
const { getInventoryStats } = require('../controllers/inventory_dashboard_stats');
const router = express.Router();

router.get('/sales', isAuthenticated, isSuper,salesData);
router.get('/dispatch', isAuthenticated, isSuper,dispatchData);
router.get('/finance', isAuthenticated, isSuper,financialSummary);
router.get('/sales-delivered', isAuthenticated,getMonthlySalesAndDelivered);
router.get("/stats", isAuthenticated, getStats);
router.get("/production-dashboard",isAuthenticated, getProductionDashboard);
router.get('/get-data-from-machine',machineStatus);
router.get('/accountant-dashboard', accountantDashboard);

// router.get('/get-machine-list',getAllMachines) // Commented out as function is disabled

// Unified API for machine data analysis
router.get('/machine-data', getMachineData);

// Debug endpoint to check database content
// router.get('/debug-machine-data', debugMachineData);

router.get('/', isAuthenticated, isSuper, dashboardWithFilter);
router.get('/welcome', isAuthenticated, getWelcomeMessage);

router.get("/inventory-stats", isAuthenticated, getInventoryStats);


router.post('/', isAuthenticated, isSuper, summary);

module.exports = router;    



