import { CrxmContentScript } from 'src/client/typeDefs';
import { convertFilePathToFuncName } from './UserscriptBundler';

interface Content {
  funcNames: string[];
  // Inject scripts using trustedTypes when using DOM inject
  useTrustedScript: boolean;
  useDomInject: boolean;
  matches: string[];
  run_at: 'document_start' | 'document_end' | 'document_idle';
}

/**
 * Generate a string of code to properly execute a functionalized script at each timing
 */
export class CodeInjector {
  // Record<MatchPattern, Content>
  private contents: Content[] = [];

  /**
   * Register function names for functionized scripts
   * @param funcName
   * @param matches
   * @param run_at
   */
  public addContent(contentScript: CrxmContentScript) {
    const { run_at, matches, js, trusted_inject, userscript_direct_inject } = contentScript;

    if (matches !== undefined) {
      if (js !== undefined) {
        const funcNames = js.map((filePath) => convertFilePathToFuncName(filePath));

        this.contents.push({
          funcNames,
          matches,
          useDomInject: userscript_direct_inject !== undefined ? userscript_direct_inject : false,
          useTrustedScript: trusted_inject !== undefined ? trusted_inject : true,
          run_at: run_at === undefined ? 'document_idle' : run_at,
        });
      }
    }
  }

  /**
   * Get code
   * @returns
   */
  public getCode() {
    let code = '';

    this.contents.forEach(({ matches, useTrustedScript, funcNames, run_at, useDomInject }) => {
      const varHash = crypto.randomUUID().replaceAll('-', '_');

      const createScriptElementVarName = () => {
        return 'crxm_script_' + varHash + crypto.randomUUID().replaceAll('-', '_');
      };

      // match if
      code +=
        '\n\nif(' +
        matches.map((match) => `location.href.match('^${match}') !== null`).join(',') +
        '){';

      let codeInner = '';

      if (useDomInject) {
        // Define idle scripts element
        const scriptElementVarName = createScriptElementVarName();
        codeInner += `\nconst ${scriptElementVarName} = document.createElement("script");`;

        if (useTrustedScript) {
          // Is this browser supported trustedTypes?
          codeInner += '\nif(unsafeWindow.trustedTypes !== undefined){';

          // If supported, it would be create policy.
          codeInner += `\nconst policy_${varHash} = unsafeWindow.trustedTypes.createPolicy("crxm-trusted-inject-policy", {createScript: (input) => input,});`;

          funcNames.forEach((funcName) => {
            codeInner += `\n${scriptElementVarName}.text = policy_${varHash}.createScript(${scriptElementVarName}.text + \`(\${${funcName}.toString()})();\`);\n`;
          });

          // end trustedTypes if
          codeInner += '} else {';

          //  For environments that do not support trustedTypes

          funcNames.forEach((funcName) => {
            codeInner += `\n${scriptElementVarName}.innerHTML = ${scriptElementVarName}.innerHTML + \`(\${${funcName}.toString()})();\``;
          });

          // end trusted else
          codeInner += '}';
        } else {
          // Dont use trustedTypes

          funcNames.forEach((funcName) => {
            codeInner += `\n${scriptElementVarName}.innerHTML = ${scriptElementVarName}.innerHTML + \`(\${${funcName}.toString()})();\``;
          });
        }

        codeInner += `\nunsafeWindow.document.body.appendChild(${scriptElementVarName});\n`;
      } else {
        funcNames.forEach((funcName) => {
          codeInner += `\n${funcName}();`;
        });
      }

      if (run_at === 'document_start') {
        code += codeInner;
      } else {
        code += this.getCodeWrappedInjectTiming(codeInner, run_at);
      }

      // end match if
      code += '}';
    });

    return code;
    /*if (CodeInjector.useDomInject) {
      return this.getCodeDomInject(CodeInjector.useTrustedScript);
    } else {
      return this.getCodeDirectRun();
    }*/
  }

  /**
   * Wrap code with appropriate syntax depending on run-at
   * @param code
   * @param runAt
   * @returns
   */
  private getCodeWrappedInjectTiming(code: string, runAt: 'document_idle' | 'document_end') {
    if (runAt === 'document_idle') {
      return (
        "document.addEventListener('DOMContentLoaded', () => {setTimeout(() => {" +
        code +
        '\n}, 1)});\n'
      );
    } else if (runAt === 'document_end') {
      return "document.addEventListener('DOMContentLoaded', () => {" + code + '\n});\n';
    } else {
      return code;
    }
  }
}
