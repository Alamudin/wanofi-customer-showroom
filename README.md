# WANOFI Customer Showroom

A responsive React + Vite storefront connected to the existing WANOFI AI MANAGER public API. Customers can browse public products, search/filter categories, see prices and availability, open product details, view product photos, and rotate/zoom GLB/GLTF models in the browser using Google's `<model-viewer>`.

## 1. Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite.

## 2. Configure

Set `VITE_API_BASE_URL` to the backend API base. Default:

`https://wanofi-ai-manager.onrender.com/api`

Optional:
- `VITE_WHATSAPP_NUMBER`: WhatsApp number with country code, digits only (Ethiopia example starts with 251; do not include `+`). If blank, the product contact button opens the configured Telegram channel.
- `VITE_TELEGRAM_CHANNEL`: public Telegram channel URL.

## 3. Deploy to Vercel

1. Create a new GitHub repository, for example `wanofi-customer-showroom`.
2. Upload/push the contents of this folder to the repository root.
3. In Vercel choose **Add New → Project**, import the repository.
4. Framework: Vite. Build command: `npm run build`. Output directory: `dist`.
5. Add environment variables:
   - `VITE_API_BASE_URL=https://wanofi-ai-manager.onrender.com/api`
   - `VITE_TELEGRAM_CHANNEL=https://t.me/YOUR_CHANNEL_USERNAME`
   - `VITE_WHATSAPP_NUMBER=251...` (optional)
6. Deploy and copy the final website origin, e.g. `https://wanofi-showroom.vercel.app`.

## 4. Backend CORS

In Render → WANOFI AI MANAGER → Environment, set:

`CUSTOMER_SITE_ORIGIN=https://YOUR-SHOWROOM-DOMAIN`

Use the exact origin only (scheme + hostname; no trailing slash or path). If you later add a custom domain, update this variable to that origin. Redeploy the backend after changing it.

The backend's public routes used here are:
- `GET /api/public/products`
- `GET /api/public/categories`
- `GET /api/public/products/<product_id>` (the app currently uses the collection response for details; the individual route remains available for future use).

## 5. Publish products

Products appear only when `show_online` is enabled in the WANOFI admin showroom settings. Add public image URLs and an HTTPS `.glb` or `.gltf` model URL to a product. The 3D model should be hosted at a publicly accessible HTTPS URL with CORS allowing the showroom domain. GLB is recommended because it packages textures in one file.

## Notes

- This is a customer-facing site; it does not expose purchase cost, supplier details, or exact stock quantity.
- Product prices and availability should be confirmed with WANOFI before purchase.
- No customer checkout/payment flow is included; the contact button directs customers to WhatsApp or Telegram.
