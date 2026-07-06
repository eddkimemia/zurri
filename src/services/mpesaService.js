const axios = require('axios');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortCode = process.env.MPESA_SHORTCODE; // Business ShortCode
    this.passkey = process.env.MPESA_PASSKEY;
    this.baseUrl = process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.b2cShortCode = process.env.MPESA_B2C_SHORTCODE;
    this.initiatorName = process.env.MPESA_INITIATOR_NAME;
    this.initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD; // Security credential (encrypted)
  }

  async getAccessToken() {
    if (process.env.MOCK_MPESA === 'true') return 'mock_token';

    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      return response.data.access_token;
    } catch (error) {
      console.error('Mpesa Auth Error:', error.response ? error.response.data : error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  /**
   * STK Push (Lipa Na M-Pesa Online)
   */
  async stkPush(phone, amount, userId) {
    if (process.env.MOCK_MPESA === 'true') {
      console.log(`[MOCK] STK Push to ${phone} for KES ${amount}`);
      return { success: true, CheckoutRequestID: 'mock_stk_' + Date.now() };
    }

    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString('base64');

    // Ensure phone is in format 2547XXXXXXXX
    let formattedPhone = phone;
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('7')) formattedPhone = '254' + formattedPhone;

    const data = {
      BusinessShortCode: this.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: this.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${this.callbackUrl}/api/mpesa/stk-callback?userId=${userId}`,
      AccountReference: 'ZuriAgency',
      TransactionDesc: 'Membership Activation'
    };

    try {
      const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { success: true, ...response.data };
    } catch (error) {
      console.error('STK Push Error:', error.response ? error.response.data : error.message);
      return { success: false, message: 'M-Pesa STK Push failed' };
    }
  }

  /**
   * B2C Payment (Business to Customer) for Withdrawals
   */
  async b2cRequest(phone, amount, withdrawalId) {
    if (process.env.MOCK_MPESA === 'true') {
      console.log(`[MOCK] B2C Payment to ${phone} for KES ${amount}`);
      return { success: true, ConversationID: 'mock_b2c_' + Date.now() };
    }

    const token = await this.getAccessToken();

    let formattedPhone = phone;
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('7')) formattedPhone = '254' + formattedPhone;

    const data = {
      InitiatorName: this.initiatorName,
      SecurityCredential: this.initiatorPassword,
      CommandID: 'BusinessPayment',
      Amount: amount,
      PartyA: this.b2cShortCode,
      PartyB: formattedPhone,
      Remarks: 'ZuriAgency Withdrawal',
      QueueTimeOutURL: `${this.callbackUrl}/api/mpesa/b2c-timeout`,
      ResultURL: `${this.callbackUrl}/api/mpesa/b2c-callback?withdrawalId=${withdrawalId}`,
      Occasion: 'Withdrawal'
    };

    try {
      const response = await axios.post(`${this.baseUrl}/mpesa/b2c/v1/paymentrequest`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { success: true, ...response.data };
    } catch (error) {
      console.error('B2C Error:', error.response ? error.response.data : error.message);
      return { success: false, message: 'M-Pesa B2C request failed' };
    }
  }
}

module.exports = new MpesaService();
