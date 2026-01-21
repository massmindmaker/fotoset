/**
 * Poll Kie.ai tasks and download results
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const KIE_API_KEY = process.env.KIE_AI_API_KEY || '2071514ba10ab85802e67750063f9c94';

const tasks = [
  { name: 'onboarding', taskId: 'fluxkontext_9eb4b7c642a14591b64030a337cea5b4', dir: 'web' },
  { name: 'dashboard', taskId: 'fluxkontext_9b3ce0ec297c4e2392088bacb7cc779d', dir: 'web' },
  { name: 'payment', taskId: 'fluxkontext_d14236cafdee47fba0a65e00187c0229', dir: 'web' },
  { name: 'admin-dashboard', taskId: 'fluxkontext_47d867f1b1b84a759360fea948c1ca1e', dir: 'admin' },
];

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
    const file = fs.createWriteStream(filepath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function pollAll(maxAttempts = 1) {
  let attempts = 0;
  let allComplete = false;

  while (attempts < maxAttempts && !allComplete) {
    attempts++;
    console.log(`\n🔄 Polling task status (attempt ${attempts}/${maxAttempts})...\n`);

    allComplete = true;

    for (const task of tasks) {
      try {
        const result = await checkTask(task.taskId);

        if (result.code === 200 && result.data) {
          const data = result.data;
          console.log(`✅ ${task.name}: ${data.status || 'completed'}`);

          // Check various possible output field names
          const imageUrl = data.output?.imageUrl || data.output?.image_url ||
                          data.result?.imageUrl || data.result?.image_url ||
                          data.imageUrl || data.image_url;

          if (imageUrl) {
            const outDir = path.join(__dirname, '..', 'NewDesign', task.dir, 'mockups');
            if (!fs.existsSync(outDir)) {
              fs.mkdirSync(outDir, { recursive: true });
            }

            const filepath = path.join(outDir, `${task.name}.png`);
            console.log(`   📥 Downloading to: ${filepath}`);
            await downloadImage(imageUrl, filepath);
            console.log(`   ✅ Saved!`);
          } else if (data.status === 'pending' || data.status === 'processing') {
            console.log(`   ⏳ Still processing...`);
            allComplete = false;
          } else {
            console.log(`   📦 Data:`, JSON.stringify(data).slice(0, 200));
          }
        } else if (result.code === 422 && result.msg === 'recordInfo is null') {
          console.log(`⏳ ${task.name}: Still processing (no record yet)`);
          allComplete = false;
        } else {
          console.log(`❓ ${task.name}:`, result.msg || 'Unknown status');
        }
      } catch (err) {
        console.log(`❌ ${task.name}: Error - ${err.message}`);
      }
    }

    if (!allComplete && attempts < maxAttempts) {
      console.log(`\n⏰ Waiting 30 seconds before next poll...`);
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  return allComplete;
}

// Run with multiple attempts if command line arg provided
const maxAttempts = parseInt(process.argv[2]) || 1;
pollAll(maxAttempts).then((complete) => {
  if (complete) {
    console.log('\n✅ All tasks completed!\n');
  } else {
    console.log('\n💡 Run again: node scripts/poll-mockups.js 10   (for 10 attempts with 30s delay)\n');
  }
});
