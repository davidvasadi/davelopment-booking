/**
 * davelopment booking — automatikus-méretezésű beágyazó-script.
 *
 * Használat a beágyazó weboldalon:
 *   <div class="davelopment-embed" data-slug="SZALON-SLUG"></div>
 *   <script src="https://<ez-a-domain>/embed.js" async></script>
 *
 * Minden `.davelopment-embed` div-be beszúr egy iframe-et, ami a publikus foglaló
 * `?embed=1` nézetét tölti be. A widget saját magától jelzi (postMessage-en keresztül)
 * a tényleges tartalom-magasságát, ez a script pedig élőben ráállítja az iframe magasságát
 * — nincs kézzel beírt `height` szám, nincs felesleges üres hely vagy belső görgetés.
 */
(function () {
  var SOURCE = 'davelopment-embed'
  // A saját <script> tag src-jéből derítjük ki, melyik domainről kell az iframe-et tölteni
  // — így ugyanez a script működik fejlesztői és éles környezetben is, hardcode-olt domain
  // nélkül.
  var scriptEl = document.currentScript
  var origin = scriptEl ? new URL(scriptEl.src).origin : ''

  function init(container) {
    if (!origin || container.dataset.davelopmentInit === '1') return
    var slug = container.getAttribute('data-slug')
    if (!slug) return
    container.dataset.davelopmentInit = '1'

    var iframe = document.createElement('iframe')
    iframe.src = origin + '/' + encodeURIComponent(slug) + '?embed=1'
    iframe.style.width = '100%'
    iframe.style.border = '0'
    iframe.style.display = 'block'
    iframe.style.height = '400px' // kezdő érték, az első postMessage azonnal felülírja
    iframe.setAttribute('scrolling', 'no')
    iframe.setAttribute('title', 'Online foglalás')
    container.appendChild(iframe)

    window.addEventListener('message', function (e) {
      if (e.origin !== origin) return
      if (!e.data || e.data.source !== SOURCE) return
      if (e.source !== iframe.contentWindow) return
      if (typeof e.data.height === 'number' && e.data.height > 0) {
        iframe.style.height = Math.ceil(e.data.height) + 'px'
      }
    })
  }

  document.querySelectorAll('.davelopment-embed').forEach(init)
})()
