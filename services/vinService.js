// Inside routes/dealership.js 
const vinValidator = require('../services/vinService');

router.post('/add-vehicle', uploadFields, async (req, res) => {
  try {
    const { vin, year, make } = req.body;
    
    const auditResults = vinValidator.auditDealerSubmission(vin, year, make);
    
    if (!auditResults.isAuthentic) {
        return res.render('dealership/add-vehicle', {
            title: 'Add Vehicle',
            error: `Fraud Prevention Alert: ${auditResults.flags.join(' ')}`,
            success: null
        });
    }

    const adminVerificationNotes = auditResults.flags.length > 0 
        ? JSON.stringify(auditResults.flags) 
        : 'Automated DNA Check: Passed Clean';

  } catch (error) { 
    console.error(error);
    res.status(500).send('Server Error');
   }
});

module.exports = router;