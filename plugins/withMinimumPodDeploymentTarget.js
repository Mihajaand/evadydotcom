const { withPodfile } = require('@expo/config-plugins');

const POST_INSTALL_ANCHOR = `    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
`;

const POD_DEPLOYMENT_TARGET_OVERRIDE = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        deployment_target = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target && deployment_target.to_f < 15.0
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
        end
      end
    end
`;

module.exports = (config) =>
  withPodfile(config, (config) => {
    const podfile = config.modResults.contents;
    if (podfile.includes(POD_DEPLOYMENT_TARGET_OVERRIDE)) return config;

    if (!podfile.includes(POST_INSTALL_ANCHOR)) {
      throw new Error(
        'Could not add the minimum CocoaPods deployment target: Expo Podfile structure changed.'
      );
    }

    config.modResults.contents = podfile.replace(
      POST_INSTALL_ANCHOR,
      `${POST_INSTALL_ANCHOR}${POD_DEPLOYMENT_TARGET_OVERRIDE}`
    );
    return config;
  });
