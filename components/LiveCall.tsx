import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera'; // Changement ici
import { Audio } from 'expo-av';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

interface LiveCallProps {
  onClose: () => void;
}

const LiveCall: React.FC<LiveCallProps> = ({ onClose }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, setMicPermission] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    (async () => {
      const { status: micStatus } = await Audio.requestPermissionsAsync();
      setMicPermission(micStatus === 'granted');
      await requestPermission();
    })();
  }, []);

  if (!permission || !micPermission) {
    return <View style={styles.container}><Text style={{color: 'white'}}>Demande d'autorisations...</Text></View>;
  }

  if (!permission.granted) {
    return <View style={styles.container}><Text style={{color: 'white'}}>Accès caméra refusé</Text></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header & AI Avatar (Même logique que ton code) */}
      
      <View style={styles.aiFeed}>
        <View style={styles.aiCircle}>
           <MaterialCommunityIcons name="robot" size={80} color="white" />
        </View>
        <Text style={styles.aiName}>Gemini Live</Text>
      </View>

      {/* Local Video Feed avec CameraView */}
      {!isVideoOff && (
        <View style={styles.localFeedContainer}>
          <CameraView 
            style={styles.localVideo} 
            facing="front" // Nouvelle syntaxe
            mode="video"
          />
        </View>
      )}

      {/* Boutons de contrôle */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity onPress={() => setIsMuted(!isMuted)} style={[styles.iconBtn, isMuted && styles.btnActiveRed]}>
          <Feather name={isMuted ? "mic-off" : "mic"} size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={styles.hangUpBtn}>
          <MaterialCommunityIcons name="phone-hangup" size={32} color="white" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsVideoOff(!isVideoOff)} style={[styles.iconBtn, isVideoOff && styles.btnActiveRed]}>
          <Feather name={isVideoOff ? "video-off" : "video"} size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  aiFeed: {
    alignItems: 'center',
    marginTop: 20,
  },
  aiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  aiName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  localFeedContainer: {
    width: width * 0.9,
    height: height * 0.5,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 16,
  },
  localVideo: {
    flex: 1,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '80%',
    alignSelf: 'center',
    marginBottom: 30,
  },
  iconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActiveRed: {
    backgroundColor: '#b41616',
  },
  hangUpBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LiveCall;