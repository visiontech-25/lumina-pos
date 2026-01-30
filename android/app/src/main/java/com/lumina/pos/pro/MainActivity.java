package com.lumina.pos.pro;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Register custom hardware plugin
    registerPlugin(LuminaHardwarePlugin.class);
  }
}
