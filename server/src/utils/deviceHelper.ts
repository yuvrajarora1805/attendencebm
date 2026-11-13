import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageDevice {
  name: string;
  mountpoint: string;
  size: string;
  model: string;
  isUsb: boolean;
  tran: string;
  fsType: string;
}

export function getServerBackupRoot(): string {
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

export function getConnectedStorageDevices(): StorageDevice[] {
  const backupDir = getServerBackupRoot();
  return [
    {
      name: 'ServerBackups',
      mountpoint: backupDir,
      size: 'Designated Folder',
      model: 'Server Backups Directory',
      isUsb: false,
      tran: 'local',
      fsType: 'dir'
    }
  ];
}

export function listFolderContents(dirPath: string): {
  folders: { name: string; fullPath: string }[];
  backupFiles: { name: string; fullPath: string; size: number; mtime: number }[];
} {
  try {
    const backupDir = getServerBackupRoot();
    let resolved = path.resolve(dirPath || backupDir);
    // Security Sandbox: Strictly clamp to server backups folder only!
    if (!resolved.startsWith(backupDir)) {
      resolved = backupDir;
    }

    if (!fs.existsSync(resolved)) return { folders: [], backupFiles: [] };
    const items = fs.readdirSync(resolved, { withFileTypes: true });

    const folders = items
      .filter(i => i.isDirectory() && !i.name.startsWith('$') && !i.name.startsWith('.'))
      .map(i => ({ name: i.name, fullPath: path.join(resolved, i.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100);

    const backupFiles = items
      .filter(i => i.isFile() && (i.name.endsWith('.json') || i.name.endsWith('.zip')))
      .map(i => {
        const full = path.join(resolved, i.name);
        let size = 0;
        let mtime = Date.now();
        try {
          const st = fs.statSync(full);
          size = st.size;
          mtime = st.mtimeMs;
        } catch {}
        return { name: i.name, fullPath: full, size, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);

    return { folders, backupFiles };
  } catch {
    return { folders: [], backupFiles: [] };
  }
}

export function listSubfolders(dirPath: string): { name: string; fullPath: string }[] {
  return listFolderContents(dirPath).folders;
}

export function copyBackupToDrive(sourceFile: string, targetPath: string): { destFile: string; checksum: string } {
  const backupDir = getServerBackupRoot();
  let resolvedTarget = path.resolve(targetPath || backupDir);
  // Security Sandbox: Prevent writing outside server backups folder!
  if (!resolvedTarget.startsWith(backupDir)) {
    resolvedTarget = backupDir;
  }

  if (!fs.existsSync(resolvedTarget)) {
    fs.mkdirSync(resolvedTarget, { recursive: true });
  }

  const fileName = path.basename(sourceFile);
  const destFile = path.join(resolvedTarget, fileName);
  const content = fs.readFileSync(sourceFile);
  fs.writeFileSync(destFile, content);

  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  return { destFile, checksum };
}
