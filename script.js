// ============ CONFIGURACIÓN ============
// Pegá acá la URL de la aplicación web de Google Apps Script (ver Code.gs).
const URL_GUARDAR = 'https://script.google.com/macros/s/AKfycbyqjvfIx8AQHhYBmrm70T9PqEvOzR_ZiTg1gpanyk0UATr_zVX_VuEO2y0Fesk8GEDSOQ/exec';

const formulario = document.getElementById('formulario');
const gracias = document.getElementById('gracias');
const grupoSi = document.getElementById('grupo-si');
const grupoNo = document.getElementById('grupo-no');
const barra = document.getElementById('progreso');
const aviso = document.getElementById('aviso-general');
const botonEnviar = document.getElementById('enviar');

// Devuelve el valor marcado de un grupo de radios ('' si no hay ninguno)
function valorRadio(nombre) {
  const marcado = document.querySelector(`input[name="${nombre}"]:checked`);
  if (marcado) {
    return marcado.value;
  } else {
    return '';
  }
}

// Muestra u oculta un bloque. Si lo oculta, borra lo que tenía marcado.
function mostrar(elemento, visible) {
  if (visible) {
    elemento.hidden = false;
    return;
  }
  if (!elemento.hidden) {
    elemento.querySelectorAll('input').forEach(i => {
      i.checked = false;
      if (i.type === 'text') i.value = '';
    });
  }
  elemento.hidden = true;
}

// Lógica de saltos: qué preguntas se ven según lo que se respondió
function actualizarVisibilidad() {
  const tiene = valorRadio('asincronicas');

  if (tiene.startsWith('si')) {
    mostrar(grupoSi, true);
    mostrar(grupoNo, false);
  } else if (tiene === 'no') {
    mostrar(grupoSi, false);
    mostrar(grupoNo, true);
  } else {
    mostrar(grupoSi, false);
    mostrar(grupoNo, false);
  }

  // Dentro del camino "no": según si le gustaría tenerlas o prefiere presencial
  const quiere = valorRadio('n_quiere');
  const nUtil = document.getElementById('n_util');
  const nPreocupa = document.getElementById('n_preocupa');
  const nPresencial = document.getElementById('n_presencial');

  if (quiere === 'si_todas' || quiere === 'si_algunas' || quiere === 'indiferente') {
    mostrar(nUtil, true);
    mostrar(nPreocupa, true);
    mostrar(nPresencial, false);
  } else if (quiere === 'no') {
    mostrar(nUtil, false);
    mostrar(nPreocupa, false);
    mostrar(nPresencial, true);
  } else {
    mostrar(nUtil, false);
    mostrar(nPreocupa, false);
    mostrar(nPresencial, false);
  }
}

// Muestra el campo de texto solo cuando se elige "Otro"
function actualizarOtros() {
  document.querySelectorAll('.pregunta').forEach(p => {
    const campo = p.querySelector('.otro-texto');
    if (!campo) return;
    const otro = p.querySelector('input[value="otro"]');
    if (otro && otro.checked) {
      campo.hidden = false;
    } else {
      campo.hidden = true;
      campo.querySelector('input').value = '';
    }
  });
}

// Si marca una opción exclusiva ("No me cuesta nada"), desmarca las demás; y al revés
function aplicarExclusivas(e) {
  if (e.target.type !== 'checkbox') return;
  const pregunta = e.target.closest('.pregunta');
  if (!pregunta || !e.target.checked) return;

  if (e.target.dataset.exclusiva === 'true') {
    pregunta.querySelectorAll('input[type="checkbox"]').forEach(c => {
      if (c !== e.target) c.checked = false;
    });
  } else {
    pregunta.querySelectorAll('input[data-exclusiva="true"]').forEach(c => c.checked = false);
  }
}

// Barra de progreso: cuántas obligatorias visibles están contestadas
function actualizarProgreso() {
  const obligatorias = [...document.querySelectorAll('.pregunta[data-requerida="si"]')]
    .filter(p => !p.closest('[hidden]'));
  const contestadas = obligatorias.filter(p => p.querySelector('input:checked')).length;
  if (obligatorias.length === 0) {
    barra.style.width = '0%';
  } else {
    barra.style.width = (contestadas / obligatorias.length * 100) + '%';
  }
}

// Validaciones antes de enviar. Devuelve true si todo está bien.
function validar() {
  let valido = true;
  let primerError = null;
  let faltantes = 0;

  document.querySelectorAll('.pregunta').forEach(p => {
    const mensajeEl = p.querySelector('.error');
    if (mensajeEl) mensajeEl.textContent = '';
    p.classList.remove('con-error');

    if (p.closest('[hidden]')) return; // las ocultas no se validan

    const marcados = p.querySelectorAll('input:checked');
    const obligatoria = p.dataset.requerida === 'si';
    const otro = p.querySelector('input[value="otro"]');
    const textoOtro = p.querySelector('.otro-texto input');
    let mensaje = '';

    if (obligatoria && marcados.length === 0) {
      mensaje = 'Esta pregunta es obligatoria.';
      faltantes++;
    } else if (otro && otro.checked && textoOtro.value.trim() === '') {
      mensaje = 'Escribí tu respuesta en "Otro".';
    }

    if (mensaje) {
      valido = false;
      if (mensajeEl) mensajeEl.textContent = mensaje;
      p.classList.add('con-error');
      if (primerError === null) primerError = p;
    }
  });

  if (!valido) {
    if (faltantes > 0) {
      aviso.textContent = `Faltan ${faltantes} pregunta${faltantes === 1 ? '' : 's'} por responder (o completar "Otro").`;
    } else {
      aviso.textContent = 'Revisá los campos marcados en rojo.';
    }
    aviso.hidden = false;
    primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    aviso.hidden = true;
  }
  return valido;
}

// Junta todas las respuestas. Cada pregunta es una clave (su id);
// las que no se mostraron quedan vacías, así la planilla siempre tiene las mismas columnas.
function recolectar() {
  const respuestas = {};
  document.querySelectorAll('.pregunta').forEach(p => {
    if (p.closest('[hidden]')) {
      respuestas[p.id] = '';
      return;
    }
    const valores = [...p.querySelectorAll('input:checked')].map(i => {
      if (i.value === 'otro') {
        return 'Otro: ' + p.querySelector('.otro-texto input').value.trim();
      }
      return i.parentElement.querySelector('span').textContent.trim();
    });
    respuestas[p.id] = valores.join(' | ');
  });
  return respuestas;
}

// Envía al Apps Script. Con no-cors no podemos leer la respuesta,
// así que si no hay error de red lo damos por guardado (se verifica en la planilla).
async function enviar(datos) {
  if (URL_GUARDAR.startsWith('PEGAR_AQUI')) {
    throw new Error('Falta configurar URL_GUARDAR en script.js.');
  }
  await fetch(URL_GUARDAR, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(datos)
  });
}

// Eventos
formulario.addEventListener('change', e => {
  aplicarExclusivas(e);
  actualizarVisibilidad();
  actualizarOtros();
  actualizarProgreso();
  // Quita el error de la pregunta en cuanto se responde
  const pregunta = e.target.closest('.pregunta');
  if (pregunta && pregunta.classList.contains('con-error') && pregunta.querySelector('input:checked')) {
    pregunta.classList.remove('con-error');
    pregunta.querySelector('.error').textContent = '';
  }
});

formulario.addEventListener('submit', async e => {
  e.preventDefault();
  if (!validar()) return;

  const datos = { fecha: new Date().toISOString(), respuestas: recolectar() };

  botonEnviar.disabled = true;
  botonEnviar.textContent = 'Enviando...';
  try {
    await enviar(datos);
    formulario.hidden = true;
    aviso.hidden = true;
    gracias.hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    aviso.textContent = 'No se pudo guardar la respuesta: ' + err.message;
    aviso.hidden = false;
  } finally {
    botonEnviar.disabled = false;
    botonEnviar.textContent = 'Enviar';
  }
});

document.getElementById('limpiar').addEventListener('click', () => {
  formulario.reset();
  aviso.hidden = true;
  actualizarVisibilidad();
  actualizarOtros();
  actualizarProgreso();
});

document.getElementById('otra').addEventListener('click', () => {
  gracias.hidden = true;
  formulario.hidden = false;
  formulario.reset();
  actualizarVisibilidad();
  actualizarOtros();
  actualizarProgreso();
  window.scrollTo(0, 0);
});

// Estado inicial
actualizarVisibilidad();
actualizarOtros();
actualizarProgreso();
