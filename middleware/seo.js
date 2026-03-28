const seoMiddleware = (req, res, next) => {
  const siteUrl = process.env.SITE_URL || 'https://beforeyousign.co.za';
  const siteName = process.env.SITE_NAME || 'Before You Sign';
  
  // Build canonical URL
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const path = req.originalUrl.split('?')[0]; // Remove query strings
  const canonical = `${protocol}://${host}${path}`;
  
  // SEO defaults
  res.locals.seo = {
    siteUrl,
    siteName,
    canonical,
    path: req.path,
    fullUrl: `${protocol}://${host}${req.originalUrl}`,
    
    // Default meta values
    title: null, // Will use siteName if null
    description: 'Scan. Verify. Buy with Confidence. South Africa\'s trusted vehicle verification platform.',
    keywords: 'vehicle verification, VIN check, car history, QR code verification, certified dealership, South Africa',
    ogImage: `${siteUrl}/assets/og-image.jpg`,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    noindex: false,
    
    // Page-specific data
    breadcrumbs: [],
    structuredData: null,
    
    // Helper methods
    setTitle(title) {
      this.title = title;
      return this;
    },
    
    setDescription(desc) {
      this.description = desc;
      return this;
    },
    
    setKeywords(kw) {
      this.keywords = kw;
      return this;
    },
    
    setCanonical(url) {
      this.canonical = url;
      return this;
    },
    
    setOgImage(url) {
      this.ogImage = url;
      return this;
    },
    
    setOgType(type) {
      this.ogType = type;
      return this;
    },
    
    noIndex() {
      this.noindex = true;
      this.robots = 'noindex, nofollow';
      return this;
    },
    
    setBreadcrumbs(items) {
      this.breadcrumbs = items;
      return this;
    }
  };
  
  // Add helper to res
  res.setSeo = (config) => {
    Object.assign(res.locals.seo, config);
  };
  
  next();
};

/**
 * Page-specific SEO configurations
 */

const seoConfigs = {
  // Homepage
  homepage: {
    title: 'Certified Vehicle History Verification',
    description: 'Scan. Verify. Buy with Confidence. The only vehicle verification platform that holds dealerships accountable with blockchain-ready QR codes and 10-point verification.',
    keywords: 'vehicle verification, VIN check, car history, QR code verification, certified dealership, consumer protection, South Africa, used car verification',
    ogType: 'website'
  },
  
  // Vehicles listing
  vehicles: {
    title: 'Browse Verified Vehicles',
    description: 'Browse certified vehicles with verified histories from ethical dealerships. All vehicles include 10-point verification reports.',
    keywords: 'used cars South Africa, certified vehicles, verified cars for sale, pre-owned vehicles, car verification',
    ogType: 'website'
  },
  
  // Vehicle detail
  vehicleDetail: (vehicle) => ({
    title: `${vehicle.year} ${vehicle.make} ${vehicle.model} - Verified Report`,
    description: `Verified ${vehicle.year} ${vehicle.make} ${vehicle.model} with complete history report. ${vehicle.mileage || 'N/A'} km, ${vehicle.fuel_type || ''} engine. View 10-point verification instantly.`,
    keywords: `${vehicle.make} ${vehicle.model}, ${vehicle.year} car for sale, verified ${vehicle.make}, used ${vehicle.model} South Africa`,
    ogType: 'product',
    ogImage: vehicle.images && vehicle.images.length > 0 ? vehicle.images[0] : null
  }),
  
  // Login
  login: {
    title: 'Login',
    description: 'Sign in to your Before You Sign account to access vehicle verification tools and manage your listings.',
    keywords: 'login, sign in, vehicle verification account',
    ogType: 'website'
  },
  
  // Register dealership
  registerDealership: {
    title: 'Become a Certified Dealer',
    description: 'Join South Africa\'s trusted network of certified dealerships. Get QR code verification for all your vehicles and build buyer confidence.',
    keywords: 'certified dealer, dealership registration, QR code verification, vehicle dealer South Africa',
    ogType: 'website'
  },
  
  // Register customer
  registerCustomer: {
    title: 'Create Account',
    description: 'Create a free Before You Sign account to save vehicle searches and get personalized recommendations.',
    keywords: 'register, create account, vehicle verification',
    ogType: 'website'
  },
  
  // 404
  notFound: {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist. Browse our verified vehicles or use the search.',
    noindex: true
  },
  
  // Error
  error: {
    title: 'Error',
    description: 'Something went wrong. Please try again or contact support.',
    noindex: true
  }
};

module.exports = {
  seoMiddleware,
  seoConfigs
};