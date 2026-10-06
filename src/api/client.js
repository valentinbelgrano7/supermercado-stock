const TOKEN_KEY = 'gondola_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

function buildUrl(path, params) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  return url.pathname + url.search;
}

async function raw(path, { method = 'GET', body, params, headers = {} } = {}) {
  const token = getToken();
  const isForm = body instanceof FormData;
  const res = await fetch(buildUrl(path, params), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      message = (await res.json()).error || message;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

export async function request(path, options) {
  const res = await raw(path, options);
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData }),
};

// Descarga un archivo autenticado (Excel, etc.)
export async function download(path, params, fallbackName = 'archivo.xlsx') {
  const res = await raw(path, { params });
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
