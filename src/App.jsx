import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ShoppingBag, Menu, X, ArrowLeft, MessageCircle, Box, Image as ImageIcon, ChevronLeft, ChevronRight, RefreshCw, Smartphone, Glasses, Watch } from 'lucide-react'

const API = (import.meta.env.VITE_API_BASE_URL || 'https://wanofi-ai-manager.onrender.com/api').replace(/\/$/, '')
const WA = (import.meta.env.VITE_WHATSAPP_NUMBER || '251924484087').replace(/\D/g, '')
const TELEGRAM = import.meta.env.VITE_TELEGRAM_CHANNEL || 'https://t.me/'
const money = value => `ETB ${Number(value || 0).toLocaleString('en-ET', { maximumFractionDigits: 2 })}`
const is530JX = p => Number(p?.id) === 82 || String(p?.sku || '').toLowerCase() === 'mb_530jx'
const isEarbuds = p => /pro\s*5s|airpods|earbuds|earbud|wireless buds|bluetooth buds/i.test(`${p?.name || p?.product_name || ''} ${p?.category || ''} ${p?.sku || ''}`)
const listImages = p => {
  const images = Array.isArray(p?.images) ? p.images.filter(Boolean) : []
  // Temporary generic preview until WANOFI uploads actual 530JX photos.
  return images.length ? images : (is530JX(p) ? ['https://vinish-models.pages.dev/phones/smartphone.webp'] : [])
}
const modelSrc = p => {
  // Use the earbuds GLB already stored in this repository for matching earbud products.
  if (isEarbuds(p)) return '/models/earbuds.glb'
  // Temporary generic smartphone model for 530JX; it is illustrative, not an exact replica.
  if (is530JX(p)) return 'https://vinish-models.pages.dev/phones/smartphone.glb'
  let raw = String(p?.model_3d_url || '').trim()
  if (!raw) return ''
  // Convert GitHub's HTML blob page URL into a direct binary URL usable by <model-viewer>.
  const githubBlob = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i)
  if (githubBlob) {
    const [, owner, repo, ref, path] = githubBlob
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`
  }
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw
  while (raw.startsWith('/')) raw = raw.slice(1)
  if (raw.startsWith('public/')) raw = raw.slice(7)
  return `/${raw}`
}

function App() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [show3d, setShow3d] = useState(true)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelError, setModelError] = useState(false)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [orderError, setOrderError] = useState('')
  const viewerWrap = useRef(null)
  const modelViewer = useRef(null)

  async function load() {
    setLoading(true)
    setError('')

    // One request only: categories are derived from the products response.
    // A timeout prevents the page from displaying an endless loading screen.
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 45000)

    try {
      const response = await fetch(`${API}/public/products`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      })

      if (!response.ok) throw new Error(`Products API returned ${response.status}`)

      const data = await response.json()
      if (data?.success === false) throw new Error(data.message || 'Products could not be loaded')

      const items = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : [])
      setProducts(items)
      setCategories([...new Set(items.map(product => product.category).filter(Boolean))])
    } catch (e) {
      console.error('WANOFI showroom load failed:', e)
      setError(e.name === 'AbortError'
        ? 'The shop server is taking too long to wake up. Please tap Try again.'
        : 'We could not connect to the shop. Please check your connection and try again.')
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // Listen to model-viewer's native events directly; React's onLoad handler
  // can miss events from some custom elements on mobile browsers.
  useEffect(() => {
    const el = modelViewer.current
    if (!el || !show3d || !selected) return
    const handleLoad = () => { setModelLoading(false); setModelError(false) }
    const handleError = () => { setModelLoading(false); setModelError(true); setShow3d(false) }
    el.addEventListener('load', handleLoad)
    el.addEventListener('error', handleError)
    if (el.loaded) handleLoad()
    return () => {
      el.removeEventListener('load', handleLoad)
      el.removeEventListener('error', handleError)
    }
  }, [selected, show3d])

  // Do not leave visitors on an endless 3D loading screen if a model host fails silently.
  useEffect(() => {
    if (!selected || !show3d || !modelLoading) return
    const timer = window.setTimeout(() => {
      setModelLoading(false)
      setModelError(true)
      setShow3d(false)
    }, 20000)
    return () => window.clearTimeout(timer)
  }, [selected, show3d, modelLoading])

  const categoryNames = useMemo(() => ['All', ...new Set([...categories.map(c => typeof c === 'string' ? c : c.name).filter(Boolean), ...products.map(p => p.category).filter(Boolean)])], [categories, products])
  const newestProducts = useMemo(() => [...products].sort((a,b) => {
    const dateA = Date.parse(a.created_at || a.createdAt || a.date_added || a.created_on || '') || 0
    const dateB = Date.parse(b.created_at || b.createdAt || b.date_added || b.created_on || '') || 0
    if (dateA && dateB) return dateB - dateA
    if (dateA) return -1
    if (dateB) return 1
    const idA = Number(a.id), idB = Number(b.id)
    return Number.isFinite(idA) && Number.isFinite(idB) ? idB - idA : 0
  }).slice(0, 4), [products])
  const filtered = useMemo(() => products.filter(p => {
    const text = `${p.name || p.product_name || ''} ${p.category || ''} ${p.sku || ''} ${p.description || ''}`.toLowerCase()
    return (category === 'All' || p.category === category) && text.includes(query.toLowerCase())
  }), [products, category, query])

  function openProduct(p) { const hasModel = Boolean(modelSrc(p)); setSelected(p); setImageIndex(0); setShow3d(hasModel); setModelLoading(hasModel); setModelError(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function choose3d() { if (modelSrc(selected)) { setModelError(false); setModelLoading(true); setShow3d(true) } }
  async function toggleViewerFullscreen() {
    const el = viewerWrap.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (el.requestFullscreen) await el.requestFullscreen()
    } catch (e) { console.warn('Fullscreen is not available in this browser.', e) }
  }
  function addToOrder(p) {
    setCart(current => {
      const found = current.find(item => String(item.product.id) === String(p.id))
      return found ? current.map(item => String(item.product.id) === String(p.id) ? {...item, qty:item.qty+1} : item) : [...current, {product:p, qty:1}]
    })
    setOrderError('')
    setCartOpen(true)
  }
  function changeQty(id, delta) {
    setCart(current => current.map(item => String(item.product.id) === String(id) ? {...item, qty:Math.max(1, item.qty+delta)} : item))
  }
  const orderTotal = cart.reduce((sum,item)=>sum+Number(item.product.price ?? item.product.selling_price ?? 0)*item.qty,0)
  function sendOrder() {
    if (!cart.length) return
    if (!customerName.trim() || !customerPhone.trim()) { setOrderError('Enter your name and phone number to send the order.'); return }
    if (!WA) { setOrderError('WANOFI admin WhatsApp number is not configured yet. Please contact the shop directly.'); return }
    const lines = cart.map((item,i)=>`${i+1}. ${item.product.name || item.product.product_name} | Qty: ${item.qty} | ${money(item.product.price ?? item.product.selling_price)} each`).join('\\n')
    const message = `NEW WANOFI SHOWROOM ORDER\\nCustomer: ${customerName.trim()}\\nPhone: ${customerPhone.trim()}\\n\\n${lines}\\n\\nEstimated total: ${money(orderTotal)}\\nNote: ${orderNote.trim() || 'None'}\\n\\nPlease confirm availability and final price.`
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    setCartOpen(false)
  }
  function contactText(p) { return `Hello WANOFI, I am interested in ${p.name || p.product_name}${p.sku ? ` (SKU: ${p.sku})` : ''}. Is it available?` }
  function contactHref(p) { const msg = encodeURIComponent(contactText(p)); return WA ? `https://wa.me/${WA}?text=${msg}` : `https://t.me/${TELEGRAM.split('/').filter(Boolean).pop()}` }

  return <div className="app-shell">
    <div className="top-strip">ADAMA, ETHIOPIA <span>—</span> QUALITY MOBILE, ACCESSORIES & FASHION</div>
    <header className="header">
      <a className="brand" href="#home" onClick={() => setSelected(null)}><span className="brand-mark">W</span><span><b>WANOFI</b><small>MOBILE & FASHION</small></span></a>
      <nav className={mobileMenu ? 'nav open' : 'nav'}>
        <a href="#home" onClick={() => {setSelected(null);setMobileMenu(false)}}>Home</a>
        <a href="#shop" onClick={() => {setSelected(null);setMobileMenu(false)}}>Shop</a>
        <a href={TELEGRAM} target="_blank" rel="noreferrer">Telegram</a>
      </nav>
      <div className="header-actions"><button className="cart-header-btn" onClick={()=>setCartOpen(true)}><ShoppingBag size={16}/> Order <b>{cart.reduce((n,x)=>n+x.qty,0)}</b></button><a className="channel-btn" href={TELEGRAM} target="_blank" rel="noreferrer">Visit channel ↗</a><button className="icon-btn mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X/> : <Menu/>}</button></div>
    </header>

    {selected ? <main className="detail-page">
      <button className="back-btn" onClick={() => setSelected(null)}><ArrowLeft size={17}/> Back to products</button>
      <div className="detail-grid">
        <section className="viewer-panel" ref={viewerWrap}>
          <div className="viewer-tabs">
            <button className={show3d && modelSrc(selected) && !modelError ? 'active' : ''} onClick={choose3d} disabled={!modelSrc(selected)}><Box size={16}/> 3D View</button>
            <button className={!show3d || !modelSrc(selected) || modelError ? 'active' : ''} onClick={() => setShow3d(false)}><ImageIcon size={16}/> Photos</button>
          </div>
          {show3d && modelSrc(selected) && !modelError ? <div className="model-stage">
            <model-viewer ref={modelViewer} key={modelSrc(selected)} src={modelSrc(selected)} loading="eager" camera-controls touch-action="pan-y" auto-rotate rotation-per-second="18deg" interaction-prompt="auto" shadow-intensity="1" exposure="1" environment-image="neutral" ar alt={selected.name || selected.product_name || '3D product model'} onLoad={() => setModelLoading(false)} onError={() => {setModelLoading(false);setModelError(true);setShow3d(false)}}>
              <div slot="progress-bar" className="model-progress"><span></span></div>
            </model-viewer>
            {modelLoading && <div className="model-loading"><span className="loader"/>Loading 3D model—</div>}
            <button className="viewer-fullscreen" type="button" onClick={toggleViewerFullscreen} aria-label="View 3D model fullscreen">⛶ <span>Full screen</span></button>
          </div> : <div className="photo-viewer">
            {modelError && <div className="model-error-note">This 3D model could not be loaded. Showing product photos instead.</div>}
            {listImages(selected).length ? <><img src={listImages(selected)[imageIndex]} alt={selected.name || selected.product_name || 'Product'} onError={e => {e.currentTarget.style.visibility='hidden'}}/>{listImages(selected).length > 1 && <><button className="gallery-arrow prev" onClick={() => setImageIndex((imageIndex - 1 + listImages(selected).length) % listImages(selected).length)} aria-label="Previous photo"><ChevronLeft/></button><button className="gallery-arrow next" onClick={() => setImageIndex((imageIndex + 1) % listImages(selected).length)} aria-label="Next photo"><ChevronRight/></button></>}</> : <div className="no-photo"><Smartphone size={64}/><span>Product photos coming soon</span></div>}
          </div>}
          {show3d && modelSrc(selected) && !modelError && <p className="viewer-hint"><RefreshCw size={14}/> Drag to rotate — Pinch to zoom — Full screen for details</p>}
          {listImages(selected).length > 0 && <div className="thumbs">{listImages(selected).map((src,i)=><button key={src+i} className={!show3d && i===imageIndex?'chosen':''} onClick={()=>{setImageIndex(i);setShow3d(false)}}><img src={src} alt={`View ${i+1}`}/></button>)}</div>}
        </section>
        <section className="detail-info"><span className="eyebrow">{selected.category || 'WANOFI COLLECTION'}</span><h1>{selected.name || selected.product_name}</h1>{selected.sku && <p className="sku">Product code: {selected.sku}</p>}<div className="detail-price">{money(selected.price ?? selected.selling_price)}</div><div className={selected.available ? 'availability in-stock' : 'availability'}><i/> {selected.available ? 'Available — contact us to confirm' : 'Currently unavailable'}</div><p className="description">{selected.description || 'Contact WANOFI for product details, specifications and current availability.'}</p>{is530JX(selected) && <p className="secure-note">3D preview is a generic smartphone illustration, not an exact 530JX model. Model credit: “Smartphone” by vinish.dev, CC BY 4.0.</p>}<button className="primary-btn contact-btn" onClick={()=>addToOrder(selected)}><ShoppingBag size={19}/> Add to order</button><p className="secure-note">Visit our shop in Adama, Ethiopia. Product availability and prices may change.</p></section>
      </div>
    </main> : <>
      <section className="hero hero-showcase" id="home"><div className="animated-ribbons" aria-hidden="true"><svg viewBox="0 0 1600 620" preserveAspectRatio="none"><defs><linearGradient id="wanofi-spectrum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#16c8ff"/><stop offset=".25" stop-color="#8a5cff"/><stop offset=".48" stop-color="#ff4bd8"/><stop offset=".72" stop-color="#ff9a45"/><stop offset="1" stop-color="#ffd66b"/></linearGradient></defs><path className="ribbon ribbon-a" d="M-80 420 C180 170 300 560 570 350 S900 80 1120 210 S1370 360 1680 90"/><path className="ribbon ribbon-b" d="M-80 500 C180 250 350 610 620 410 S920 150 1150 260 S1420 420 1680 180"/><path className="ribbon ribbon-c" d="M-80 330 C190 90 390 430 650 280 S950 30 1190 150 S1430 300 1680 30"/></svg><span className="ribbon-wordmark">WANOFI</span></div><div className="hero-content"><span className="eyebrow light">WELCOME TO WANOFI</span><h1>Good tech.<br/><em>Great style.</em></h1><p>Premium mobile, accessories and fashion products for a better everyday.</p><div className="hero-ctas"><a href="#shop" className="primary-btn smart-btn">Explore Products <span>›</span></a><a href="#categories" className="secondary-btn smart-btn">View Categories</a></div><div className="hero-foot"><span><Smartphone size={17}/> Mobile & tech</span><span><Glasses size={17}/> Style & fashion</span><span><Box size={17}/> 3D product view</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-card"><div className="hero-card-top">WANOFI <span>✦</span></div><div className="phone-art"><div className="phone-camera"/><div className="phone-screen"><span>W</span><small>Explore more.</small></div></div><div className="hero-card-bottom">DISCOVER YOUR STYLE <b>01 / 03</b></div></div><div className="floating-tag">NEW ARRIVALS <b>✦</b></div></div><div className="hero-benefits"><span>✧ <b>High Quality</b><small>Premium products</small></span><span>↗ <b>Fast Delivery</b><small>Across Ethiopia</small></span><span>◈ <b>Secure Order</b><small>100% safe ordering</small></span><span>◉ <b>24/7 Support</b><small>We’re here to help</small></span></div></section>
      <section className="promo-band" aria-label="WANOFI shopping highlights">
        <div className="promo-copy"><span className="eyebrow light">THE WANOFI EXPERIENCE</span><h2>Good tech.<br/><em>Great style.</em></h2><p>Discover everyday essentials, thoughtful accessories and standout style—all selected for you.</p><a href="#shop" className="promo-link">Shop the collection <span>↗</span></a></div>
        <div className="promo-highlights"><div><span>01</span><b>Explore</b><small>Browse phones, accessories & fashion</small></div><div><span>02</span><b>Discover</b><small>See selected products in interactive 3D</small></div><div><span>03</span><b>Order</b><small>Send your selection to WANOFI on WhatsApp</small></div></div>
        <div className="promo-orbit" aria-hidden="true">W</div>
      </section>
      <section className="new-arrivals" aria-label="New arrivals"><div className="new-arrivals-heading"><div><span className="eyebrow">JUST LANDED AT WANOFI</span><h2>New arrivals<span>✦</span></h2><p>Fresh finds from our latest collection.</p></div><a href="#shop">View all products ↗</a></div>
        {loading ? <div className="new-arrivals-loading">Discovering the latest collection…</div> : newestProducts.length ? <div className="arrival-grid">{newestProducts.map((p,i)=><article className="arrival-card" key={p.id || p.sku || i} onClick={()=>openProduct(p)}><div className="arrival-image">{listImages(p).length ? <img src={listImages(p)[0]} alt={p.name || p.product_name} loading="lazy"/> : <div className="arrival-placeholder">{(p.name || p.product_name || "W").slice(0,1).toUpperCase()}</div>}<span>NEW PICK</span><button onClick={e=>{e.stopPropagation();addToOrder(p)}} aria-label="Add product to order">＋</button></div><div className="arrival-info"><small>{p.category || "WANOFI COLLECTION"}</small><h3>{p.name || p.product_name}</h3><b>{money(p.price ?? p.selling_price)}</b></div></article>)}</div> : <p className="new-arrivals-loading">New products are coming soon. Explore the full collection below.</p>}
      </section>
      <main id="shop" className="shop-section"><div className="section-heading"><div><span className="eyebrow">THE WANOFI COLLECTION</span><h2>Explore products</h2><p>Find what you love. Open a product to see its details and 3D model when available.</p></div><div className="product-count">{products.length} <span>products</span></div></div>
        <div className="toolbar"><div className="category-list">{categoryNames.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products..."/><kbd>⌕</kbd></label></div>
        {loading ? <div className="state-box"><div className="loader"/><p>Loading WANOFI collection...</p></div> : error ? <div className="state-box"><p>{error}</p><button className="outline-btn" onClick={load}><RefreshCw size={16}/> Try again</button></div> : filtered.length ? <div className="product-grid">{filtered.map((p,i)=><article className="product-card" key={p.id || p.sku || i} onClick={()=>openProduct(p)}><div className="product-image">{listImages(p).length ? <img src={listImages(p)[0]} alt={p.name || p.product_name} loading="lazy"/> : <div className="placeholder"><span>{(p.name || p.product_name || 'W').slice(0,1).toUpperCase()}</span><small>WANOFI</small></div>}{modelSrc(p) && <span className="three-d-badge"><Box size={13}/> 3D VIEW</span>}<button className="quick-view" aria-label="View product" onClick={e=>{e.stopPropagation();openProduct(p)}}>View details ↗</button><button className="card-add-order" onClick={e=>{e.stopPropagation();addToOrder(p)}}>＋ Add</button></div><div className="product-meta"><span>{p.category || 'COLLECTION'}</span><span className={p.available ? 'dot available' : 'dot'}>{p.available ? 'Available' : 'Unavailable'}</span></div><h3>{p.name || p.product_name}</h3><div className="card-bottom"><b>{money(p.price ?? p.selling_price)}</b><button onClick={e=>{e.stopPropagation();openProduct(p)}} aria-label="Open product">↗</button></div></article>)}</div> : <div className="state-box"><ShoppingBag size={34}/><h3>No products found</h3><p>Try another search or category.</p><button className="outline-btn" onClick={()=>{setQuery('');setCategory('All')}}>Clear filters</button></div>}
      </main>
    </>}
    {cartOpen && <div className="order-backdrop" onClick={()=>setCartOpen(false)}><section className="order-panel" onClick={e=>e.stopPropagation()}><div className="order-head"><div><span className="eyebrow">WANOFI CHECKOUT</span><h2>Your order</h2></div><button onClick={()=>setCartOpen(false)} aria-label="Close order"><X/></button></div>{cart.length ? <><div className="order-items">{cart.map(item=><div className="order-item" key={item.product.id}><div><b>{item.product.name || item.product.product_name}</b><small>{money(item.product.price ?? item.product.selling_price)} each</small></div><div className="qty-control"><button onClick={()=>changeQty(item.product.id,-1)}>−</button><b>{item.qty}</b><button onClick={()=>changeQty(item.product.id,1)}>＋</button><button className="remove-item" onClick={()=>setCart(c=>c.filter(x=>String(x.product.id)!==String(item.product.id)))}>×</button></div></div>)}</div><div className="order-total"><span>Estimated total</span><b>{money(orderTotal)}</b></div><label className="order-field">Your name<input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Full name"/></label><label className="order-field">Phone number<input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="+251 9... " inputMode="tel"/></label><label className="order-field">Order note (optional)<textarea value={orderNote} onChange={e=>setOrderNote(e.target.value)} placeholder="Color, size, preferred option..."/></label>{orderError && <p className="order-error">{orderError}</p>}<button className="primary-btn send-order-btn" onClick={sendOrder}><MessageCircle size={18}/> Send order to WANOFI admin</button><p className="order-disclaimer">Your order will open WhatsApp with the order details ready to send. WANOFI will confirm availability and final price.</p></> : <div className="empty-order"><ShoppingBag size={36}/><p>Your order list is empty.</p><button className="outline-btn" onClick={()=>setCartOpen(false)}>Continue shopping</button></div>}</section></div>}
    <footer className="footer"><div className="footer-main"><a className="brand footer-brand" href="#home"><span className="brand-mark">W</span><span><b>WANOFI</b><small>MOBILE & FASHION</small></span></a><p>Technology, accessories and style — all in one place.</p><a className="footer-link" href={TELEGRAM} target="_blank" rel="noreferrer">Follow WANOFI on Telegram ↗</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} WANOFI MOBILE & FASHION</span><span>ADAMA, ETHIOPIA</span></div></footer>
  </div>
}
export default App
