import { basename } from 'path';
import { Define } from '../BundlerRegisterer';
import { FilePath } from '../typeDefs';

/**
 * Inject crxm vars (`__crxm_build_id` and `__crxm_running_env`)
 * @param rawCode
 * @param buildId
 * @param env
 * @returns
 */
export function crxmVarinjection(
  rawCode: string | Uint8Array,
  buildId: string,
  env: string,
  scope: 'iife' | 'wrapper' = 'iife',
) {
  const code = typeof rawCode === 'string' ? rawCode : new TextDecoder().decode(rawCode);
  const declarations = [
    'var __crxm_build_id = ' + JSON.stringify(buildId) + ';',
    'var __crxm_running_env = ' + JSON.stringify(env) + ';',
    '',
  ].join('\n');

  if (scope === 'wrapper') {
    return declarations + code;
  }

  const iifeRegex = /(\((?:async\s+)?(?:function.*?|.*?=>)\s*\{)/;
  return code.replace(iifeRegex, (opening) => opening + '\n' + declarations);
}

export function createDefinedCode(rawCode: string | Uint8Array, defines: Define[]) {
  const varcode =
    defines
      .map(({ name, value }) => {
        return `var ${name} = ${value};`;
      })
      .join('\n') + '\n';

  if (typeof rawCode !== 'string') {
    const decoder = new TextDecoder();
    const decorded = decoder.decode(rawCode);
    return varcode + decorded;
  }

  return varcode + rawCode;
}

/**
 * Convert a file extension that is .ts to .js.
 * @param filePath
 * @returns A filePath that extension converted to .js.
 */
export function changeExt<T extends FilePath<'absolute' | 'relative'>>(
  filePath: T,
  newExt: string,
) {
  const rawFileNameSplited = basename(filePath).split('.');
  rawFileNameSplited[rawFileNameSplited.length - 1] = newExt;
  const newFilename = rawFileNameSplited.join('.');
  return newFilename as T;
}
