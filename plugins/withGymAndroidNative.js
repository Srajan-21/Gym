const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');

const PACKAGE_DIR = path.join('com', 'srajan', 'gymtracker');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function withGymAndroidNative(config) {
  // 1. Add Android permissions, FloatingLoggerService, and GymWidgetProvider to AndroidManifest.xml
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    const requiredPerms = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    ];

    for (const perm of requiredPerms) {
      if (!manifest['uses-permission'].some((p) => p.$['android:name'] === perm)) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    const application = manifest.application?.[0];
    if (application) {
      application.service = application.service || [];
      if (
        !application.service.some(
          (s) => s.$['android:name'] === '.FloatingLoggerService'
        )
      ) {
        application.service.push({
          $: {
            'android:name': '.FloatingLoggerService',
            'android:enabled': 'true',
            'android:exported': 'false',
            'android:foregroundServiceType': 'specialUse',
          },
        });
      }

      application.receiver = application.receiver || [];
      if (
        !application.receiver.some(
          (r) => r.$['android:name'] === '.GymWidgetProvider'
        )
      ) {
        application.receiver.push({
          $: {
            'android:name': '.GymWidgetProvider',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [
                { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
                { $: { 'android:name': 'com.srajan.gymtracker.ACTION_ADD_WATER' } },
              ],
            },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.appwidget.provider',
                'android:resource': '@xml/gym_widget_info',
              },
            },
          ],
        });
      }
    }

    return mod;
  });

  // 2. Register GymNativePackage in MainApplication.kt
  config = withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes('GymNativePackage()')) {
      contents = contents.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n              add(GymNativePackage())'
      );
      mod.modResults.contents = contents;
    }
    return mod;
  });

  // 3. Copy Kotlin & XML files into android/app/src/main/
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const srcBase = path.join(projectRoot, 'plugins', 'android');
      const androidMain = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'src',
        'main'
      );

      const kotlinDest = path.join(androidMain, 'java', PACKAGE_DIR);
      ensureDir(kotlinDest);
      for (const file of [
        'GymNativeModule.kt',
        'GymNativePackage.kt',
        'FloatingLoggerService.kt',
        'GymWidgetProvider.kt',
      ]) {
        fs.copyFileSync(path.join(srcBase, file), path.join(kotlinDest, file));
      }

      const layoutDest = path.join(androidMain, 'res', 'layout');
      const xmlDest = path.join(androidMain, 'res', 'xml');
      ensureDir(layoutDest);
      ensureDir(xmlDest);
      fs.copyFileSync(
        path.join(srcBase, 'res', 'layout', 'gym_widget.xml'),
        path.join(layoutDest, 'gym_widget.xml')
      );
      fs.copyFileSync(
        path.join(srcBase, 'res', 'xml', 'gym_widget_info.xml'),
        path.join(xmlDest, 'gym_widget_info.xml')
      );

      return mod;
    },
  ]);

  return config;
}

module.exports = withGymAndroidNative;
