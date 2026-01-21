/**
 * Poll PinGlass Light Mode mockup tasks and download results
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const KIE_API_KEY = process.env.KIE_AI_API_KEY || '2071514ba10ab85802e67750063f9c94';

// Load tasks from file
const tasksPath = path.join(__dirname, '..', 'NewDesign', 'pinglass-light-tasks.json');

if (!fs.existsSync(tasksPath)) {
  console.error('❌ Tasks file not found. Run generate-light-mode-mockups.js first.');
  process.exit(1);
}

const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

async function checkTask(taskId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.kie.ai',
      path: `/api/v1/jobs/recordInfo?taskId=${taskId}`,
      headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl) => {
      https.get(reqUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }

        const file = fs.createWriteStream(filepath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filepath);
        });
      }).on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    };
    doRequest(url);
  });
}

async function pollAll(maxAttempts = 30) {
  let attempts = 0;
  let allComplete = false;
  const completed = new Set();

  // Create output directory for light mode
  const outDir = path.join(__dirname, '..', 'NewDesign', 'web', 'mockups-light');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  while (attempts < maxAttempts && !allComplete) {
    attempts++;
    console.log(`\n🔄 Polling task status (attempt ${attempts}/${maxAttempts})...\n`);

    allComplete = true;

    for (const task of tasks) {
      if (completed.has(task.taskId)) {
        console.log(`✅ ${task.name}: Already downloaded`);
        continue;
      }

      try {
        const result = await checkTask(task.taskId);

        if (result.code === 200 && result.data) {
          const data = result.data;
          const status = data.status || data.state;

          if (status === 'success' || status === 'completed') {
            // Parse resultJson field (Kie.ai returns URL as JSON string)
            let imageUrl = null;
            if (data.resultJson) {
              try {
                const parsed = JSON.parse(data.resultJson);
                imageUrl = parsed.resultUrls?.[0] || parsed.resultUrl || parsed.url;
              } catch (e) {
                console.log(`   ⚠️ Failed to parse resultJson: ${e.message}`);
              }
            }
            // Fallback to other field names
            if (!imageUrl) {
              imageUrl = data.output?.imageUrl ||
                         data.output?.image_url ||
                         data.output?.url ||
                         data.result?.imageUrl ||
                         data.result?.image_url ||
                         data.imageUrl ||
                         data.image_url ||
                         data.url;
            }

            if (imageUrl) {
              const ext = imageUrl.includes('.png') ? 'png' : 'jpg';
              const filepath = path.join(outDir, `${task.name}.${ext}`);
              console.log(`📥 ${task.name}: Downloading...`);
              await downloadImage(imageUrl, filepath);
              console.log(`   ✅ Saved: ${filepath}`);
              completed.add(task.taskId);
            } else {
              console.log(`⚠️  ${task.name}: Completed but no image URL found`);
              console.log(`   Data keys: ${Object.keys(data).join(', ')}`);
            }
          } else if (status === 'pending' || status === 'processing' || status === 'running') {
            console.log(`⏳ ${task.name}: ${status}...`);
            allComplete = false;
          } else if (status === 'failed' || status === 'error') {
            console.log(`❌ ${task.name}: Failed`);
            completed.add(task.taskId);
          } else {
            console.log(`❓ ${task.name}: Unknown status "${status}"`);
            allComplete = false;
          }
        } else if (result.code === 422 && result.msg === 'recordInfo is null') {
          console.log(`⏳ ${task.name}: Still processing (no record yet)`);
          allComplete = false;
        } else {
          console.log(`❓ ${task.name}: ${result.msg || 'Unknown response'}`);
          allComplete = false;
        }
      } catch (err) {
        console.log(`❌ ${task.name}: Error - ${err.message}`);
      }
    }

    if (!allComplete && attempts < maxAttempts) {
      console.log(`\n⏰ Waiting 15 seconds before next poll...`);
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  console.log(`\n📊 Summary: ${completed.size}/${tasks.length} mockups downloaded`);

  if (completed.size === tasks.length) {
    console.log(`\n✅ All light mode mockups saved to: ${outDir}`);
    console.log(`\n📋 Next: Update the gallery HTML to include light mode mockups`);
  } else {
    console.log(`\n💡 Run again for more attempts: node scripts/poll-light-mockups.js`);
  }

  return completed.size === tasks.length;
}

// Run with configurable attempts
const maxAttempts = parseInt(process.argv[2]) || 30;
pollAll(maxAttempts);
