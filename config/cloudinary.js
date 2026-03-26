// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: 'dpdira4rd',
  api_key: '713111334354171',
  api_secret: '0CaNTrKRWWke__aAd1pIXmxJ4Bo'
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'before-you-sign/vehicles';
    let resource_type = 'image';

    if (file.fieldname === 'serviceHistoryPdf' || file.fieldname === 'accidentHistoryPdf') {
      folder = 'before-you-sign/documents';
      resource_type = 'auto'; 
    }

    return {
      folder: folder,
      resource_type: resource_type,
      public_id: `${file.fieldname}-${Date.now()}`,
      flags: "attachment" // Optional: force download if you prefer
    };
  }
});

module.exports = { cloudinary, storage };