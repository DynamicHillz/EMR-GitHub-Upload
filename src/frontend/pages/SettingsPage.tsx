import React, { useState, useEffect } from 'react';
import { Save, Upload, Palette, DollarSign, Settings2, Building2 } from 'lucide-react';
import { applyTheme } from '../utils/theme';

interface BrandingSettings {
  id: string;
  name: string;
  clinicName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface BillingConfig {
  currency: string;
  currencySymbol: string;
  taxEnabled: boolean;
  defaultTaxRate: number;
  taxName: string;
  taxId: string | null;
  acceptCash: boolean;
  acceptCard: boolean;
  acceptMobileMoney: boolean;
  acceptBankTransfer: boolean;
  acceptInsurance: boolean;
  invoicePrefix: string;
  invoiceStartNumber: number;
  invoiceFooterText: string | null;
  termsAndConditions: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  swiftCode: string | null;
  mobileMoneyProvider: string | null;
  mobileMoneyNumber: string | null;
  mobileMoneyName: string | null;
}

type TabType = 'branding' | 'clinic' | 'billing';

// Currency symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
  ZAR: 'R',
  GHS: '₵',
};

// Helper function to convert image share URLs to direct image URLs
const convertImageUrl = (url: string): string => {
  if (!url) return url;

  // Check if it's a Google Drive URL
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Check if it's an Imgur album/gallery URL (not direct image)
  // Album: https://imgur.com/a/XqEhSHX or https://imgur.com/gallery/XqEhSHX
  // Convert to direct: https://i.imgur.com/XqEhSHX.png (try common extensions)
  const imgurAlbumMatch = url.match(/imgur\.com\/(?:a|gallery)\/([a-zA-Z0-9]+)/);
  if (imgurAlbumMatch) {
    const imageId = imgurAlbumMatch[1];
    // Try .png first (most common), user can adjust if needed
    return `https://i.imgur.com/${imageId}.png`;
  }

  // Check if it's already a direct Imgur URL
  if (url.includes('i.imgur.com')) {
    return url;
  }

  return url;
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('branding');
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Branding state
  const [logoUrl, setLogoUrl] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [address, setAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#10b981');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [fontFamily, setFontFamily] = useState('Inter');

  // Billing state
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);
  const [taxName, setTaxName] = useState('VAT');
  const [taxId, setTaxId] = useState('');
  const [acceptCash, setAcceptCash] = useState(true);
  const [acceptCard, setAcceptCard] = useState(true);
  const [acceptMobileMoney, setAcceptMobileMoney] = useState(true);
  const [acceptBankTransfer, setAcceptBankTransfer] = useState(true);
  const [acceptInsurance, setAcceptInsurance] = useState(false);
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [invoiceStartNumber, setInvoiceStartNumber] = useState(1000);
  const [invoiceFooterText, setInvoiceFooterText] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState('');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [mobileMoneyName, setMobileMoneyName] = useState('');
  const [paystackEnabled, setPaystackEnabled] = useState(false);
  const [paystackPublicKey, setPaystackPublicKey] = useState('');
  const [paystackSecretKey, setPaystackSecretKey] = useState('');
  const [flutterwaveEnabled, setFlutterwaveEnabled] = useState(false);
  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState('');
  const [flutterwaveSecretKey, setFlutterwaveSecretKey] = useState('');
  const [moniepointEnabled, setMoniepointEnabled] = useState(false);
  const [moniepointApiKey, setMoniepointApiKey] = useState('');
  const [moniepointContractCode, setMoniepointContractCode] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle currency change - auto-update symbol
  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    const symbol = CURRENCY_SYMBOLS[newCurrency] || '$';
    setCurrencySymbol(symbol);
  };

  // Handle logo URL change - auto-convert Google Drive URLs
  const handleLogoUrlChange = (url: string) => {
    const convertedUrl = convertImageUrl(url);
    setLogoUrl(convertedUrl);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch branding
      const brandingResponse = await fetch('http://localhost:3000/api/branding', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (brandingResponse.ok) {
        const brandingData = await brandingResponse.json();
        setBranding(brandingData.data);
        // Convert Google Drive URL if needed
        const convertedLogoUrl = convertImageUrl(brandingData.data.logoUrl || '');
        setLogoUrl(convertedLogoUrl);
        setClinicName(brandingData.data.clinicName || '');
        setAddress(brandingData.data.address || '');
        setPrimaryColor(brandingData.data.primaryColor);
        setSecondaryColor(brandingData.data.secondaryColor);
        setAccentColor(brandingData.data.accentColor);
        setFontFamily(brandingData.data.fontFamily);
      }

      // Fetch billing config
      const billingResponse = await fetch('http://localhost:3000/api/billing/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (billingResponse.ok) {
        const billingData = await billingResponse.json();
        const config = billingData.data;
        setBillingConfig(config);
        setCurrency(config.currency);
        setCurrencySymbol(config.currencySymbol);
        setTaxEnabled(config.taxEnabled);
        setDefaultTaxRate(parseFloat(config.defaultTaxRate));
        setTaxName(config.taxName);
        setTaxId(config.taxId || '');
        setAcceptCash(config.acceptCash);
        setAcceptCard(config.acceptCard);
        setAcceptMobileMoney(config.acceptMobileMoney);
        setAcceptBankTransfer(config.acceptBankTransfer);
        setAcceptInsurance(config.acceptInsurance);
        setInvoicePrefix(config.invoicePrefix);
        setInvoiceStartNumber(config.invoiceStartNumber);
        setInvoiceFooterText(config.invoiceFooterText || '');
        setTermsAndConditions(config.termsAndConditions || '');
        setBankName(config.bankName || '');
        setAccountNumber(config.accountNumber || '');
        setAccountName(config.accountName || '');
        setSwiftCode(config.swiftCode || '');
        setMobileMoneyProvider(config.mobileMoneyProvider || '');
        setMobileMoneyNumber(config.mobileMoneyNumber || '');
        setMobileMoneyName(config.mobileMoneyName || '');
        setPaystackEnabled(config.paystackEnabled || false);
        setPaystackPublicKey(config.paystackPublicKey || '');
        setPaystackSecretKey(config.paystackSecretKey || '');
        setFlutterwaveEnabled(config.flutterwaveEnabled || false);
        setFlutterwavePublicKey(config.flutterwavePublicKey || '');
        setFlutterwaveSecretKey(config.flutterwaveSecretKey || '');
        setMoniepointEnabled(config.moniepointEnabled || false);
        setMoniepointApiKey(config.moniepointApiKey || '');
        setMoniepointContractCode(config.moniepointContractCode || '');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          clinicName: clinicName || null,
          address: address || null,
          logoUrl: logoUrl || null,
          primaryColor,
          secondaryColor,
          accentColor,
          fontFamily
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Branding updated successfully!' });
        setBranding(data.data);
        applyTheme({ primaryColor, secondaryColor, accentColor });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update branding' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBilling = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/billing/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currency,
          currencySymbol,
          taxEnabled,
          defaultTaxRate,
          taxName,
          taxId: taxId || null,
          acceptCash,
          acceptCard,
          acceptMobileMoney,
          acceptBankTransfer,
          acceptInsurance,
          invoicePrefix,
          invoiceStartNumber,
          invoiceFooterText: invoiceFooterText || null,
          termsAndConditions: termsAndConditions || null,
          bankName: bankName || null,
          accountNumber: accountNumber || null,
          accountName: accountName || null,
          swiftCode: swiftCode || null,
          mobileMoneyProvider: mobileMoneyProvider || null,
          mobileMoneyNumber: mobileMoneyNumber || null,
          mobileMoneyName: mobileMoneyName || null,
          paystackEnabled,
          paystackPublicKey: paystackPublicKey || null,
          paystackSecretKey: paystackSecretKey || null,
          flutterwaveEnabled,
          flutterwavePublicKey: flutterwavePublicKey || null,
          flutterwaveSecretKey: flutterwaveSecretKey || null,
          moniepointEnabled,
          moniepointApiKey: moniepointApiKey || null,
          moniepointContractCode: moniepointContractCode || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Billing configuration updated successfully!' });
        setBillingConfig(data.data);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update billing configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Clinic Settings</h1>
        <p className="text-gray-600 mt-2">Configure your clinic's settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('branding')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'branding'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Palette className="w-5 h-5" />
            <span>Branding & Theme</span>
          </button>

          <button
            onClick={() => setActiveTab('clinic')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'clinic'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span>Clinic Information</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'billing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            <span>Billing Configuration</span>
          </button>
        </nav>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* Color Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Palette className="w-4 h-4 mr-2" />
                Color Theme
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Primary Color */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Primary Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      placeholder="#3b82f6"
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded-lg"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>

                {/* Secondary Color */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Secondary Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      placeholder="#10b981"
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded-lg"
                    style={{ backgroundColor: secondaryColor }}
                  />
                </div>

                {/* Accent Color */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Accent Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      placeholder="#f59e0b"
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded-lg"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Inter">Inter (Default)</option>
                <option value="system-ui">System UI</option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
              </select>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t">
              <button
                onClick={handleSaveBranding}
                disabled={saving}
                className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>

          {/* Color Presets */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Color Presets</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => {
                  setPrimaryColor('#3b82f6');
                  setSecondaryColor('#10b981');
                  setAccentColor('#f59e0b');
                }}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
              >
                <div className="flex space-x-2 mb-2">
                  <div className="w-8 h-8 rounded bg-blue-500" />
                  <div className="w-8 h-8 rounded bg-green-500" />
                  <div className="w-8 h-8 rounded bg-amber-500" />
                </div>
                <p className="text-sm font-medium">Default</p>
              </button>

              <button
                onClick={() => {
                  setPrimaryColor('#8b5cf6');
                  setSecondaryColor('#ec4899');
                  setAccentColor('#f43f5e');
                }}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 transition-colors"
              >
                <div className="flex space-x-2 mb-2">
                  <div className="w-8 h-8 rounded bg-purple-500" />
                  <div className="w-8 h-8 rounded bg-pink-500" />
                  <div className="w-8 h-8 rounded bg-rose-500" />
                </div>
                <p className="text-sm font-medium">Purple</p>
              </button>

              <button
                onClick={() => {
                  setPrimaryColor('#0ea5e9');
                  setSecondaryColor('#06b6d4');
                  setAccentColor('#14b8a6');
                }}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-cyan-500 transition-colors"
              >
                <div className="flex space-x-2 mb-2">
                  <div className="w-8 h-8 rounded bg-sky-500" />
                  <div className="w-8 h-8 rounded bg-cyan-500" />
                  <div className="w-8 h-8 rounded bg-teal-500" />
                </div>
                <p className="text-sm font-medium">Ocean</p>
              </button>

              <button
                onClick={() => {
                  setPrimaryColor('#059669');
                  setSecondaryColor('#65a30d');
                  setAccentColor('#ca8a04');
                }}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-600 transition-colors"
              >
                <div className="flex space-x-2 mb-2">
                  <div className="w-8 h-8 rounded bg-emerald-600" />
                  <div className="w-8 h-8 rounded bg-lime-600" />
                  <div className="w-8 h-8 rounded bg-yellow-600" />
                </div>
                <p className="text-sm font-medium">Nature</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinic Info Tab */}
      {activeTab === 'clinic' && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Clinic Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinic Name
            </label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Enter clinic name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">This will appear on invoices, reports, and throughout the system</p>
          </div>

          {/* Clinic Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinic Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter complete clinic address"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">This will appear on printed documents, invoices, and reports</p>
          </div>

          {/* Logo Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Upload className="w-4 h-4 mr-2" />
              Clinic Logo URL
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Enter the URL of your clinic logo. Supports Google Drive, Imgur, Cloudinary, or direct image links.
              <br />
              <span className="text-blue-600">Tip: For Google Drive, paste the share link and it will be auto-converted!</span>
            </p>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => handleLogoUrlChange(e.target.value)}
              placeholder="https://example.com/logo.png or Google Drive share link"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {logoUrl && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Logo Preview:</p>
                <div className="space-y-2">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="max-h-20 object-contain"
                    onError={(e) => {
                      console.error('Logo failed to load:', logoUrl);
                      (e.target as HTMLImageElement).alt = 'Failed to load logo';
                      (e.target as HTMLImageElement).className = 'text-red-600 text-sm';
                    }}
                    onLoad={() => {
                      console.log('Logo loaded successfully:', logoUrl);
                    }}
                  />
                  <div className="text-xs text-gray-500 break-all">
                    <strong>URL:</strong> {logoUrl}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Clinic Info Display */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Current Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {branding?.address && (
                <div>
                  <span className="font-medium text-gray-600">Address:</span>
                  <span className="ml-2 text-gray-800">{branding.address}</span>
                </div>
              )}
              {branding?.phone && (
                <div>
                  <span className="font-medium text-gray-600">Phone:</span>
                  <span className="ml-2 text-gray-800">{branding.phone}</span>
                </div>
              )}
              {branding?.email && (
                <div>
                  <span className="font-medium text-gray-600">Email:</span>
                  <span className="ml-2 text-gray-800">{branding.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <button
              onClick={handleSaveBranding}
              disabled={saving}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Billing Configuration Tab */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-3">General Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="NGN">NGN - Nigerian Naira</option>
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="ZAR">ZAR - South African Rand</option>
                  <option value="GHS">GHS - Ghanaian Cedi</option>
                </select>
              </div>

              {/* Currency Symbol */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  maxLength={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tax Settings */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={taxEnabled}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Enable Tax</label>
              </div>

              {taxEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tax Name</label>
                    <input
                      type="text"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      placeholder="VAT"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Default Tax Rate (%)</label>
                    <input
                      type="number"
                      value={defaultTaxRate}
                      onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value))}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID (Optional)</label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="e.g., TIN123456"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-3">Payment Methods</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptCash}
                  onChange={(e) => setAcceptCash(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Accept Cash</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptCard}
                  onChange={(e) => setAcceptCard(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Accept Card</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptMobileMoney}
                  onChange={(e) => setAcceptMobileMoney(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Accept Mobile Money</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptBankTransfer}
                  onChange={(e) => setAcceptBankTransfer(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Accept Bank Transfer</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptInsurance}
                  onChange={(e) => setAcceptInsurance(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Accept Insurance</label>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          {acceptBankTransfer && (
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-3">Bank Details</h3>
              <p className="text-sm text-gray-600">These details will appear on invoices for bank transfer payments</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., First Bank"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g., 1234567890"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g., SSMC Clinic Ltd"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SWIFT/BIC Code (Optional)</label>
                  <input
                    type="text"
                    value={swiftCode}
                    onChange={(e) => setSwiftCode(e.target.value)}
                    placeholder="e.g., FBNINGLA"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mobile Money Details */}
          {acceptMobileMoney && (
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-3">Mobile Money Details</h3>
              <p className="text-sm text-gray-600">These details will appear on invoices for mobile money payments</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                  <input
                    type="text"
                    value={mobileMoneyProvider}
                    onChange={(e) => setMobileMoneyProvider(e.target.value)}
                    placeholder="e.g., M-Pesa, MTN"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                  <input
                    type="text"
                    value={mobileMoneyNumber}
                    onChange={(e) => setMobileMoneyNumber(e.target.value)}
                    placeholder="e.g., +234 123 456 7890"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={mobileMoneyName}
                    onChange={(e) => setMobileMoneyName(e.target.value)}
                    placeholder="e.g., SSMC Clinic"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Invoice Settings */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-3">Invoice Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Prefix</label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="INV"
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Invoices will be numbered as: {invoicePrefix}-{invoiceStartNumber}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Starting Invoice Number</label>
                <input
                  type="number"
                  value={invoiceStartNumber}
                  onChange={(e) => setInvoiceStartNumber(parseInt(e.target.value))}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Footer Text (Optional)</label>
              <textarea
                value={invoiceFooterText}
                onChange={(e) => setInvoiceFooterText(e.target.value)}
                rows={2}
                placeholder="e.g., Thank you for your business!"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions (Optional)</label>
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={4}
                placeholder="Enter payment terms, refund policy, or other conditions..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          {/* Payment Gateway Configuration */}
  <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
    <h3 className="text-lg font-semibold text-gray-800 border-b pb-3">Payment Gateway Configuration</h3>
    <p className="text-sm text-gray-600">Configure online payment processors (API keys are stored securely)</p>

    {/* Paystack */}
    <div className="space-y-4">
      <div className="flex items-center">
        <input type="checkbox" checked={paystackEnabled} onChange={(e) => setPaystackEnabled(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
        <label className="ml-2 text-sm font-medium text-gray-700">Enable Paystack</label>
      </div>
      {paystackEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
            <input type="text" value={paystackPublicKey} onChange={(e) => setPaystackPublicKey(e.target.value)} placeholder="pk_..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
            <input type="password" value={paystackSecretKey} onChange={(e) => setPaystackSecretKey(e.target.value)} placeholder="sk_..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
      )}
    </div>

    {/* Flutterwave */}
    <div className="space-y-4">
      <div className="flex items-center">
        <input type="checkbox" checked={flutterwaveEnabled} onChange={(e) => setFlutterwaveEnabled(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
        <label className="ml-2 text-sm font-medium text-gray-700">Enable Flutterwave</label>
      </div>
      {flutterwaveEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
            <input type="text" value={flutterwavePublicKey} onChange={(e) => setFlutterwavePublicKey(e.target.value)} placeholder="FLWPUBK-..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
            <input type="password" value={flutterwaveSecretKey} onChange={(e) => setFlutterwaveSecretKey(e.target.value)} placeholder="FLWSECK-..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
      )}
    </div>

    {/* Moniepoint */}
    <div className="space-y-4">
      <div className="flex items-center">
        <input type="checkbox" checked={moniepointEnabled} onChange={(e) => setMoniepointEnabled(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
        <label className="ml-2 text-sm font-medium text-gray-700">Enable Moniepoint</label>
      </div>
      {moniepointEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            <input type="password" value={moniepointApiKey} onChange={(e) => setMoniepointApiKey(e.target.value)} placeholder="Enter API key" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contract Code</label>
            <input type="text" value={moniepointContractCode} onChange={(e) => setMoniepointContractCode(e.target.value)} placeholder="Enter contract code" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
      )}
    </div>
  </div>

          {/* Save Button */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <button
              onClick={handleSaveBilling}
              disabled={saving}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Billing Configuration'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
