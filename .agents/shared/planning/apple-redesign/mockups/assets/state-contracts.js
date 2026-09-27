// This controls only which static design specimen is visible. No app logic, authentication or API.
(() => {
  const panels = [...document.querySelectorAll('.specimen__panel')];
  const links = [...document.querySelectorAll('.specimen__index a')];
  function show() {
    const id = decodeURIComponent(location.hash.slice(1));
    const selected = panels.find(el => el.id === id) || panels[0];
    panels.forEach(el => el.classList.toggle('is-visible', el === selected));
    links.forEach(el => {
      if(el.hash === `#${selected.id}`) el.setAttribute('aria-current','true');
      else el.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange',show);show();
})();
