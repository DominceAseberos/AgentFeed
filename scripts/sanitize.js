import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧹 Starting standalone sanitization process...');

// Parse .env to get local settings for static files
let envSupabaseUrl = 'https://vafuyqgqextgqhhjegie.supabase.co';
let envAppUrl = 'http://localhost:8080';

const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=["']?([^"'\s]+)["']?/);
  if (urlMatch) {
    envSupabaseUrl = urlMatch[1];
  }
}

// 1. Sanitize vite.config.ts
const viteConfigPath = path.join(rootDir, 'vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
  const cleanViteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
`;
  fs.writeFileSync(viteConfigPath, cleanViteConfig, 'utf8');
  console.log('✅ Sanitized: vite.config.ts');
}

// 2. Sanitize package.json (remove lovable-tagger)
const packageJsonPath = path.join(rootDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.devDependencies && packageJson.devDependencies['lovable-tagger']) {
    delete packageJson.devDependencies['lovable-tagger'];
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
    console.log('✅ Removed "lovable-tagger" from package.json devDependencies');
  }
}

// 3. Walk through src/ and sanitize hardcoded URLs & footprints in code files
function walkAndSanitize(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkAndSanitize(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;

      // Rule A: Single-quoted BASE_URL in Landing.tsx (and elsewhere) -> backticks BASE_URL
      if (content.includes("'https://mcjrltowlmwhsjfvbmkk.supabase.co/functions/v1'")) {
        content = content.replace(
          /'https:\/\/mcjrltowlmwhsjfvbmkk\.supabase\.co\/functions\/v1'/g,
          '`${import.meta.env.VITE_SUPABASE_URL}/functions/v1`'
        );
        changed = true;
      }

      // Rule B: Backtick BASE_URL in ApiDocs.tsx (and elsewhere) -> dynamic backticks BASE_URL
      if (content.includes("`https://mcjrltowlmwhsjfvbmkk.supabase.co/functions/v1`")) {
        content = content.replace(
          /`https:\/\/mcjrltowlmwhsjfvbmkk\.supabase\.co\/functions\/v1`/g,
          '`${import.meta.env.VITE_SUPABASE_URL}/functions/v1`'
        );
        changed = true;
      }

      // Rule C: Single-quoted copy text in Landing.tsx -> backticks template literal
      if (content.includes("'Read https://agent-feed.lovable.app/Feed.md and follow the instructions.'")) {
        content = content.replace(
          /'Read https:\/\/agent-feed\.lovable\.app\/Feed\.md and follow the instructions\.'/g,
          '`Read ${import.meta.env.VITE_APP_URL || window.location.origin}/Feed.md and follow the instructions.`'
        );
        changed = true;
      }

      // Rule D: Backtick SITE_URL in ApiDocs.tsx -> dynamic backticks SITE_URL
      if (content.includes("`https://agent-feed.lovable.app`")) {
        content = content.replace(
          /`https:\/\/agent-feed\.lovable\.app`/g,
          '`${import.meta.env.VITE_APP_URL || window.location.origin}`'
        );
        changed = true;
      }

      // Rule E: Plain text or JSX instructions -> JSX curly expression
      if (content.includes("Read https://agent-feed.lovable.app/Feed.md and follow the instructions.")) {
        content = content.replace(
          /Read https:\/\/agent-feed\.lovable\.app\/Feed\.md and follow the instructions\./g,
          'Read {import.meta.env.VITE_APP_URL || window.location.origin}/Feed.md and follow the instructions.'
        );
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Sanitized file: ${path.relative(rootDir, filePath)}`);
      }
    }
  }
}

const srcDir = path.join(rootDir, 'src');
if (fs.existsSync(srcDir)) {
  walkAndSanitize(srcDir);
}

// 4. Sanitize static markdown files (Feed.md & README.md) with actual .env values
const markdownFiles = [
  path.join(rootDir, 'public', 'Feed.md'),
  path.join(rootDir, 'README.md')
];

for (const mdPath of markdownFiles) {
  if (fs.existsSync(mdPath)) {
    let content = fs.readFileSync(mdPath, 'utf8');
    let changed = false;

    if (content.includes('https://mcjrltowlmwhsjfvbmkk.supabase.co')) {
      content = content.replace(/https:\/\/mcjrltowlmwhsjfvbmkk\.supabase\.co/g, envSupabaseUrl);
      changed = true;
    }

    if (content.includes('https://agent-feed.lovable.app')) {
      content = content.replace(/https:\/\/agent-feed\.lovable\.app/g, envAppUrl);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(mdPath, content, 'utf8');
      console.log(`✅ Sanitized markdown file: ${path.relative(rootDir, mdPath)}`);
    }
  }
}

console.log('🎉 Sanitization completed successfully!');
