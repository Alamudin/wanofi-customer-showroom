import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ShoppingBag, Menu, X, ArrowLeft, MessageCircle, Box, Image as ImageIcon, ChevronLeft, ChevronRight, RefreshCw, Smartphone, Glasses, Watch } from 'lucide-react'

const API = (import.meta.env.VITE_API_BASE_URL || 'https://wanofi-ai-manager.onrender.com/api').replace(/\/$/, '')
const WA = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '')
const TELEGRAM = import.meta.env.VITE_TELEGRAM_CHANNEL || 'https://t.me/'
const money = value => `ETB ${Number(value || 0).toLocaleString('en-ET', { maximumFractionDigits: 2 })}`
const listImages = p => Array.isArray(p?.images) ? p.images.filter(Boolean) : []
const modelSrc = p => {
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
      <div className="header-actions"><a className="channel-btn" href={TELEGRAM} target="_blank" rel="noreferrer">Visit channel ↗</a><button className="icon-btn mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X/> : <Menu/>}</button></div>
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
        <section className="detail-info"><span className="eyebrow">{selected.category || 'WANOFI COLLECTION'}</span><h1>{selected.name || selected.product_name}</h1>{selected.sku && <p className="sku">Product code: {selected.sku}</p>}<div className="detail-price">{money(selected.price ?? selected.selling_price)}</div><div className={selected.available ? 'availability in-stock' : 'availability'}><i/> {selected.available ? 'Available — contact us to confirm' : 'Currently unavailable'}</div><p className="description">{selected.description || 'Contact WANOFI for product details, specifications and current availability.'}</p><a className="primary-btn contact-btn" href={contactHref(selected)} target="_blank" rel="noreferrer"><MessageCircle size={19}/> Ask about this product</a><p className="secure-note">Visit our shop in Adama, Ethiopia. Product availability and prices may change.</p></section>
      </div>
    </main> : <>
      <section className="hero" id="home"><div className="hero-content"><span className="eyebrow light">WELCOME TO WANOFI</span><h1>Find your next<br/><em>favorite thing.</em></h1><p>Explore our collection of mobile phones, accessories and fashion. View products up close and discover selected items in interactive 3D.</p><a href="#shop" className="primary-btn">Explore collection <span>↗</span></a><div className="hero-foot"><span><Smartphone size={17}/> Mobile & tech</span><span><Glasses size={17}/> Style & fashion</span><span><Box size={17}/> 3D product view</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-card"><div className="hero-card-top">WANOFI <span>✦</span></div><div className="phone-art"><div className="phone-camera"/><div className="phone-screen"><span>W</span><small>Explore more.</small></div></div><div className="hero-card-bottom">DISCOVER YOUR STYLE <b>01 / 03</b></div></div><div className="floating-tag">NEW ARRIVALS <b>✦</b></div></div></section>
      <main id="shop" className="shop-section"><div className="section-heading"><div><span className="eyebrow">THE WANOFI COLLECTION</span><h2>Explore products</h2><p>Find what you love. Open a product to see its details and 3D model when available.</p></div><div className="product-count">{products.length} <span>products</span></div></div>
        <div className="toolbar"><div className="category-list">{categoryNames.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products..."/><kbd>⌕</kbd></label></div>
        {loading ? <div className="state-box"><div className="loader"/><p>Loading WANOFI collection...</p></div> : error ? <div className="state-box"><p>{error}</p><button className="outline-btn" onClick={load}><RefreshCw size={16}/> Try again</button></div> : filtered.length ? <div className="product-grid">{filtered.map((p,i)=><article className="product-card" key={p.id || p.sku || i} onClick={()=>openProduct(p)}><div className="product-image">{listImages(p).length ? <img src={listImages(p)[0]} alt={p.name || p.product_name} loading="lazy"/> : <div className="placeholder"><span>{(p.name || p.product_name || 'W').slice(0,1).toUpperCase()}</span><small>WANOFI</small></div>}{modelSrc(p) && <span className="three-d-badge"><Box size={13}/> 3D VIEW</span>}<button className="quick-view" aria-label="View product" onClick={e=>{e.stopPropagation();openProduct(p)}}>View details ↗</button></div><div className="product-meta"><span>{p.category || 'COLLECTION'}</span><span className={p.available ? 'dot available' : 'dot'}>{p.available ? 'Available' : 'Unavailable'}</span></div><h3>{p.name || p.product_name}</h3><div className="card-bottom"><b>{money(p.price ?? p.selling_price)}</b><button onClick={e=>{e.stopPropagation();openProduct(p)}} aria-label="Open product">↗</button></div></article>)}</div> : <div className="state-box"><ShoppingBag size={34}/><h3>No products found</h3><p>Try another search or category.</p><button className="outline-btn" onClick={()=>{setQuery('');setCategory('All')}}>Clear filters</button></div>}
      </main>
    </>}
    <footer className="footer"><div className="footer-main"><a className="brand footer-brand" href="#home"><span className="brand-mark">W</span><span><b>WANOFI</b><small>MOBILE & FASHION</small></span></a><p>Technology, accessories and style — all in one place.</p><a className="footer-link" href={TELEGRAM} target="_blank" rel="noreferrer">Follow WANOFI on Telegram ↗</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} WANOFI MOBILE & FASHION</span><span>ADAMA, ETHIOPIA</span></div></footer>
  </div>
}
export default App
