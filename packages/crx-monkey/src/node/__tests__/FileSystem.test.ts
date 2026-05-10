import { describe, it, expect, beforeEach, spyOn, afterEach, mock } from 'bun:test';
import { FileSystem } from '../FileSystem';
import fse, { existsSync, mkdtempSync, rmdirSync, writeFile } from 'fs-extra';
import { FilePath } from '../typeDefs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('"noCacheImport" can import javascript module', () => {
  let testDir: string;

  let fileSystem: FileSystem;

  beforeEach(() => {
    fileSystem = new FileSystem();
    testDir = mkdtempSync(join(tmpdir(), 'test-'));
    spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(() => {
    mock.restore();
    if (existsSync(join(tmpdir(), 'test-'))) {
      rmdirSync(join(tmpdir(), 'test-'));
    }
  });

  it('It can import javascript module as named', async () => {
    const content = 'Module content';
    const moduleName = 'module';
    const modulePath = join(testDir, 'module.js') as FilePath;

    await writeFile(modulePath, `export const ${moduleName} =  "${content}"`);

    const module = await fileSystem.noCacheImport<{ [moduleName]: string }>(modulePath);

    expect(module[moduleName]).toBe(content);
  });

  it('It can import javascript module as default', async () => {
    const content = 'Module content';
    const modulePath = join(testDir, 'module.js') as FilePath;

    await writeFile(modulePath, `export default "${content}"`);

    const module = await fileSystem.noCacheImport<{ default: string }>(modulePath);

    expect(module.default).toBe(content);
  });

  it('It does not have cache for a javascript module', async () => {
    const modulePath = join(testDir, 'module.js') as FilePath;

    const content1 = 'Module content1';
    await writeFile(modulePath, `export default "${content1}"`);
    const module1 = await fileSystem.noCacheImport<{ default: string }>(modulePath);

    const content2 = 'Module content2';
    await writeFile(modulePath, `export default "${content2}"`);
    const module2 = await fileSystem.noCacheImport<{ default: string }>(modulePath);

    expect(module1.default).toBe(content1);
    expect(module2.default).toBe(content2);
  });

  it('It should throw an error if the module does not exist', async () => {
    await expect(
      fileSystem.noCacheImport<{ default: string }>('example' as FilePath),
    ).rejects.toThrow('The module ');
  });
});

describe('"noCacheImport" can import typescript module', () => {
  let testDir: string;
  let fileSystem: FileSystem;

  beforeEach(() => {
    fileSystem = new FileSystem();
    testDir = mkdtempSync(join(tmpdir(), 'test-'));
    spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(() => {
    mock.restore();
    if (existsSync(join(tmpdir(), 'test-'))) {
      rmdirSync(join(tmpdir(), 'test-'));
    }
  });

  it('It can import typescript module as named', async () => {
    const content = 'Module content';
    const moduleName = 'module';
    const modulePath = join(testDir, 'module.ts') as FilePath;

    await writeFile(modulePath, `export const ${moduleName} : string =  "${content}"`);

    const module = await fileSystem.noCacheImport<{ [moduleName]: string }>(modulePath);

    expect(module[moduleName]).toBe(content);
  });

  it('It can import typescript module as default', async () => {
    const content = 'Module content';
    const modulePath = join(testDir, 'module.ts') as FilePath;

    await writeFile(modulePath, `const m : string = "${content}";\nexport default m;`);

    const module = await fileSystem.noCacheImport<{ default: string }>(modulePath);

    expect(module.default).toBe(content);
  });

  it('It does not have cache for a typescript module', async () => {
    const modulePath = join(testDir, 'module.ts') as FilePath;

    const content1 = 'Module content1';
    await writeFile(modulePath, `const m : string = "${content1}";\nexport default m;`);
    const module1 = await fileSystem.noCacheImport<{ default: string }>(modulePath);

    const content2 = 'Module content2';
    await writeFile(modulePath, `const m : string = "${content2}";\nexport default m;`);
    const module2 = await fileSystem.noCacheImport<{ default: string }>(modulePath);

    expect(module1.default).toBe(content1);
    expect(module2.default).toBe(content2);
  });
});

describe('FileSystem', () => {
  let fileSystem: FileSystem;

  beforeEach(() => {
    fileSystem = new FileSystem();
  });

  describe('Direct Reference Methods (Identity Tests)', () => {
    it('should hold direct references to fse methods for simple proxies', () => {
      // Read
      expect(fileSystem.readFile).toBe(fse.readFile);
      expect(fileSystem.readFileSync).toBe(fse.readFileSync);

      // Readdir
      expect(fileSystem.readdir).toBe(fse.readdir);
      expect(fileSystem.readdirSync).toBe(fse.readdirSync);

      // Write
      expect(fileSystem.writeFile).toBe(fse.writeFile);
      expect(fileSystem.writeFileSync).toBe(fse.writeFileSync);

      // Remove
      expect(fileSystem.remove).toBe(fse.remove);
      expect(fileSystem.removeSync).toBe(fse.removeSync);

      // Copy
      expect(fileSystem.copy).toBe(fse.copy);
      expect(fileSystem.copySync).toBe(fse.copySync);

      // Output
      expect(fileSystem.outputFile).toBe(fse.outputFile);
      expect(fileSystem.outputFileSync).toBe(fse.outputFileSync);

      // Watch & Sub-modules
      expect(fileSystem.watch).toBe(fse.watch);
      expect(fileSystem.promises).toBe(fse.promises);
    });
  });

  describe('Wrapped Methods (Delegation Tests)', () => {
    it('should delegate exists() to fse.exists', async () => {
      const spy = spyOn(fse, 'exists').mockResolvedValue(true as never);
      const testPath = '/test/path';

      const result = await fileSystem.exists(testPath);

      expect(spy).toHaveBeenCalledWith(testPath);
      expect(result).toBe(true);
      spy.mockRestore();
    });

    it('should delegate existsSync() to fse.existsSync', () => {
      const spy = spyOn(fse, 'existsSync').mockReturnValue(false);
      const testPath = '/test/path/sync';

      const result = fileSystem.existsSync(testPath);

      expect(spy).toHaveBeenCalledWith(testPath);
      expect(result).toBe(false);
      spy.mockRestore();
    });
  });
});

describe('fileToDataUri', () => {
  let fileSystem: FileSystem;

  beforeEach(() => {
    fileSystem = new FileSystem();
  });

  it('should return a base64 data URI for a given file', async () => {
    const mockBuffer = Buffer.from('hello world');
    const readFileSpy = spyOn(fileSystem, 'readFile').mockResolvedValue(mockBuffer as never);
    const testPath = 'test.txt' as FilePath;

    const result = await fileSystem.fileToDataUri(testPath);

    // Expected: data:text/plain;base64,aGVsbG8gd29ybGQ=
    expect(result).toStartWith('data:text/plain;base64,');
    expect(result).toContain(mockBuffer.toString('base64'));

    readFileSpy.mockRestore();
  });

  it('should fallback to application/octet-stream for unknown extensions', async () => {
    const mockBuffer = Buffer.from('binary');
    spyOn(fileSystem, 'readFile').mockResolvedValue(mockBuffer as never);
    const testPath = 'unknown' as FilePath;

    const result = await fileSystem.fileToDataUri(testPath);

    expect(result).toStartWith('data:application/octet-stream;base64,');
  });
});
