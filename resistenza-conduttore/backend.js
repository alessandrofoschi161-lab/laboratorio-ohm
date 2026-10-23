const REPORT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzbwHSQ9hXo2PCQOrD80eZ3qz-CUl5YPecC3vAL7GwQOWruVpqAJAk-D4A0QeW8KR5qhQ/exec';

async function submitReport(){
  const payload = collectReport();
  const st = document.getElementById('submit-status');

  if(!payload.meta.classe || !payload.meta.gruppo || !payload.meta.nomi){
    st.innerHTML = '<div class="warning">Completa classe, gruppo e componenti prima della consegna.</div>';
    return;
  }

  if(!payload.answers.wire || !payload.answers.temp){
    st.innerHTML = '<div class="warning">Completa entrambe le conclusioni prima della consegna.</div>';
    return;
  }

  st.innerHTML = '<div class="note">Invio della relazione in corso… Non chiudere questa pagina.</div>';

  try {
    const body = new URLSearchParams();
    body.append('payload', JSON.stringify(payload));

    const response = await fetch(REPORT_BACKEND_URL, {
      method: 'POST',
      body,
      redirect: 'follow'
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch(e) {
      throw new Error('Risposta non valida dal server. Controlla la distribuzione Apps Script.');
    }

    if(!result.ok){
      throw new Error(result.error || 'Errore sconosciuto durante il salvataggio.');
    }

    st.innerHTML = `<div class="success">Relazione consegnata correttamente: <b>${result.name}</b></div>`;
  } catch(err) {
    console.error(err);
    st.innerHTML = `<div class="warning">Invio non riuscito: ${err.message || err}. Usa “Stampa / salva PDF” come copia di sicurezza e avvisa il docente.</div>`;
  }
}
