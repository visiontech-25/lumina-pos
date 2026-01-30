package com.lumina.pos.pro;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;

@CapacitorPlugin(
  name = "LuminaHardware",
  permissions = {
    @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN }, alias = "bluetooth")
  }
)
public class LuminaHardwarePlugin extends Plugin {
  private JSObject config = null;

  // Bluetooth SPP UUID
  private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

  @PluginMethod
  public void configure(PluginCall call) {
    this.config = call.getObject("config", call.getData());
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void printEscpos(PluginCall call) {
    String bytesBase64 = call.getString("bytesBase64", null);
    String target = call.getString("target", "receipt");
    if (bytesBase64 == null) {
      call.reject("Missing bytesBase64");
      return;
    }
    byte[] bytes;
    try {
      bytes = android.util.Base64.decode(bytesBase64, android.util.Base64.DEFAULT);
    } catch (Exception e) {
      call.reject("Invalid base64", e);
      return;
    }

    JSObject printer = getPrinterConfig(target);
    if (printer == null) {
      call.reject("No printer configured");
      return;
    }
    String type = printer.getString("connectionType", "system");
    if ("system".equals(type)) {
      // No-op: web fallback handles printing
      call.resolve(new JSObject().put("ok", true).put("mode", "system"));
      return;
    }
    if ("network".equals(type)) {
      String ip = printer.getString("ip", null);
      int port = printer.getInteger("port", 9100);
      if (ip == null) {
        call.reject("Missing printer IP");
        return;
      }
      try {
        sendTcp(ip, port, bytes);
        call.resolve(new JSObject().put("ok", true).put("mode", "network"));
      } catch (Exception e) {
        call.reject("Network print failed", e);
      }
      return;
    }
    if ("bluetooth".equals(type)) {
      if (Build.VERSION.SDK_INT >= 31) {
        if (getPermissionState("bluetooth") != com.getcapacitor.PermissionState.GRANTED) {
          requestPermissionForAlias("bluetooth", call, "bluetoothPermsCallback");
          return;
        }
      }
      String mac = printer.getString("bluetoothMac", null);
      if (mac == null) {
        call.reject("Missing bluetoothMac");
        return;
      }
      try {
        sendBluetooth(mac, bytes);
        call.resolve(new JSObject().put("ok", true).put("mode", "bluetooth"));
      } catch (Exception e) {
        call.reject("Bluetooth print failed", e);
      }
      return;
    }
    call.reject("Unsupported printer type: " + type);
  }

  @PermissionCallback
  private void bluetoothPermsCallback(PluginCall call) {
    // Retry after permission grant
    printEscpos(call);
  }

  @PluginMethod
  public void openCashDrawer(PluginCall call) {
    // Most drawers are opened via ESC/POS pulse on the receipt printer.
    // The app already builds pulse bytes and may call printEscpos directly.
    call.resolve(new JSObject().put("ok", true));
  }

  @PluginMethod
  public void scanBarcode(PluginCall call) {
    // Most scanners act as keyboard wedges; no native scan here yet.
    call.resolve(null);
  }

  private JSObject getPrinterConfig(String target) {
    if (config == null) return null;
    JSObject p = null;
    if ("kitchen".equals(target)) {
      p = config.getJSObject("kitchenPrinter");
    } else {
      p = config.getJSObject("receiptPrinter");
    }
    return p;
  }

  private void sendTcp(String ip, int port, byte[] bytes) throws Exception {
    Socket socket = new Socket();
    socket.connect(new InetSocketAddress(ip, port), 8000);
    OutputStream os = socket.getOutputStream();
    os.write(bytes);
    os.flush();
    os.close();
    socket.close();
  }

  private void sendBluetooth(String mac, byte[] bytes) throws Exception {
    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
    if (adapter == null) throw new Exception("Bluetooth not available");
    BluetoothDevice device = adapter.getRemoteDevice(mac);
    BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
    adapter.cancelDiscovery();
    socket.connect();
    OutputStream os = socket.getOutputStream();
    os.write(bytes);
    os.flush();
    os.close();
    socket.close();
  }
}

