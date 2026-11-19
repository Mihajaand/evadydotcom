export const getEdgeFunctionErrorMessage = async (error, fallbackMessage) => {
  const response = error?.context;
  if (response && typeof response.clone === 'function') {
    const body = await response.clone().json().catch(() => null);
    const serverMessage = body?.error || body?.message;
    if (serverMessage) return `${serverMessage} (HTTP ${response.status})`;
    return `${error?.message || fallbackMessage} (HTTP ${response.status})`;
  }

  return error?.message || fallbackMessage;
};
