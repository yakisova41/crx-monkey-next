import consola from 'consola';
import chalk from 'chalk';
import fse from 'fs-extra';
import path from 'path';

async function getLatestVersion(packageName: string) {
  return fetch(`https://registry.npmjs.org/${packageName}/latest`)
    .then((res) => res.json())
    .then((data) => {
      return data.version;
    });
}

const projectName = await consola.prompt('Project name', { type: 'text' });
const language = await consola.prompt('Select a Language', {
  type: 'select',
  options: [chalk.blueBright('Typescript'), chalk.yellow('Javascript')],
});
const isTs = language === chalk.blueBright('Typescript') ? true : false;

const packageJsonPrototype = {
  name: projectName,
  version: '1.0.0',
  private: true,
  type: 'module',
  scripts: {
    crx: 'npx crx-monkey',
    dev: 'npx crx-monkey dev',
    build: 'npx crx-monkey build',
  },
  devDependencies: {
    'crx-monkey': '^' + (await getLatestVersion('crx-monkey')),
    '@types/chrome': '^' + (await getLatestVersion('@types/chrome')),
  },
};

const files = {
  content: `content_scripts/main.${isTs ? 'ts' : 'js'}`,
  sw: `sw/main.${isTs ? 'ts' : 'js'}`,
  popupScript: `popup/main.${isTs ? 'ts' : 'js'}`,
  popupHTML: `popup/index.html`,
};

const manifestJsonPrototype = {
  name: projectName,
  version: '1.0.0',
  manifest_version: 3,
  description: 'description',
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: [files.content],
    },
  ],
  action: {
    default_popup: files.popupHTML,
  },
  background: {
    service_worker: files.sw,
  },
};

const manifestJs = `
// @ts-check
import { defineManifest } from 'crx-monkey/client';

export default defineManifest(
${JSON.stringify(manifestJsonPrototype, undefined, 2)
  .split('\n')
  .map((x) => '  ' + x)
  .join('\n')}
);
`;

fse.mkdir(projectName);

fse.outputFile(path.join(projectName, files.content), "console.log('contentscirpt');");

fse.outputFile(path.join(projectName, files.sw), "console.log('service worker');");

fse.outputFile(path.join(projectName, files.popupScript), "console.log('popup');");

fse.outputFile(
  path.join(projectName, files.popupHTML),
  `<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Popup</title>
</head>
<body>
  <p>Crx monkey popup</p>
  <script src="./popup.js"></script>
</body>
</html>
`,
);

fse.outputFile(
  path.join(projectName, 'package.json'),
  JSON.stringify(packageJsonPrototype, undefined, 2),
);

fse.outputFile(path.join(projectName, 'manifest.js'), manifestJs);

fse.outputFile(
  path.join(projectName, 'crxm.config.js'),
  `
import { defineConfig } from 'crx-monkey/client';

const config = defineConfig({});
  `,
);

if (isTs) {
  fse.outputFile(
    path.join(projectName, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          allowJs: false,
          skipLibCheck: true,
          esModuleInterop: false,
          strict: true,
          forceConsistentCasingInFileNames: true,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          baseUrl: '.',
          types: ['chrome'],
        },
      },
      undefined,
      2,
    ),
  );
}

console.log('\n');
consola.success('Project created!');
consola.info('Build the project environment with the following commands');
consola.box([`cd ${projectName}`, 'npm install'].join('\n'));
