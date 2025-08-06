// Simple module federation loader for PoC
const loadedModules: { [key: string]: any } = {};

export async function loadRemoteComponent(
  componentName: string,
  url: string,
): Promise<any> {
  if (loadedModules[componentName]) {
    return loadedModules[componentName];
  }

  try {
    // In a real implementation, this would use Module Federation
    // For PoC, we'll simulate with dynamic imports
    const response = await fetch(url);
    const code = await response.text();

    // WARNING: eval is used here only for PoC purposes
    // In production, use proper Module Federation
    const module = eval(code);
    loadedModules[componentName] = module.default || module;

    return loadedModules[componentName];
  } catch (error) {
    console.error(error);
  }
}
