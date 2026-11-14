import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CameraMode,
  CinematicTourId,
  ConstructionDraft,
  MobileInputState,
  NearbyInteractable,
  PlayerProfile,
  TimeOfDay,
  TownPlot,
  WeatherMode,
} from './types';
import { detectSoftwareWebGL } from './utils/webgl';
import { createCityTextureSet } from './materials/proceduralTextures';
import { RoadAndSidewalkSystem } from './world/RoadAndSidewalkSystem';
import { CentralPark } from './world/CentralPark';
import { PlotRenderer } from './world/PlotRenderer';
import { TrafficManager } from './simulation/TrafficManager';
import { PedestrianManager } from './simulation/PedestrianManager';
import { WeatherEffects } from './simulation/WeatherEffects';
import { CameraFocusTarget, CityCameraController } from './camera/CityCameraController';
import { WindTimeUpdater } from './assets/FoliageAndProps';
import { DynamicVehicleObstacle } from './simulation/WorldCollision';
import {
  PlayerPoseState,
  WalkingPlayerController,
} from './player/WalkingPlayerController';
import { NightStreetLights } from './world/NightStreetLights';
import { SkyAndMoon } from './world/SkyAndMoon';
import { SpatialBirdAudioController } from './audio/SpatialBirdAudioController';

interface CitySceneProps {
  plots: TownPlot[];
  cameraMode: CameraMode;
  cinematicTour: CinematicTourId;
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  selectedPlotId: string | null;
  constructionDraft: ConstructionDraft;
  playerProfile: PlayerProfile;
  sittingBenchId: string | null;
  openDoors: Record<string, boolean>;
  playerPoseRef: React.MutableRefObject<PlayerPoseState>;
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  vehicleStatesRef: React.MutableRefObject<DynamicVehicleObstacle[]>;
  focusTargetRef: React.MutableRefObject<CameraFocusTarget | null>;
  birdAudioEnabled: boolean;
  onSelectPlot: (plot: TownPlot | null) => void;
  onSelectBench?: (benchId: string) => void;
  onActiveInteractionChange: (item: NearbyInteractable | null) => void;
  onTriggerPrimaryAction: () => void;
  onWebGLContextError?: () => void;
}

const LIGHTING_PRESETS: Record<
  TimeOfDay,
  {
    skyColor: string;
    fogColor: string;
    sunPos: [number, number, number];
    sunColor: string;
    sunIntensity: number;
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
    exposure: number;
  }
> = {
  morning: {
    skyColor: '#d9ebf5',
    fogColor: '#e4eff6',
    sunPos: [82, 52, -45],
    sunColor: '#fff1d6',
    sunIntensity: 1.9,
    hemiSky: '#c4e0f5',
    hemiGround: '#7a705b',
    hemiIntensity: 0.72,
    exposure: 1.04,
  },
  afternoon: {
    skyColor: '#c6dff2',
    fogColor: '#d6e7f4',
    sunPos: [72, 92, 58],
    sunColor: '#fff6e3',
    sunIntensity: 2.15,
    hemiSky: '#a8d1f0',
    hemiGround: '#726652',
    hemiIntensity: 0.74,
    exposure: 1.05,
  },
  sunset: {
    skyColor: '#e5bc96',
    fogColor: '#eccaa7',
    sunPos: [-92, 32, 48],
    sunColor: '#ffae66',
    sunIntensity: 2.2,
    hemiSky: '#c7b5d1',
    hemiGround: '#69503d',
    hemiIntensity: 0.64,
    exposure: 1.06,
  },
  night: {
    skyColor: '#040710',
    fogColor: '#050a16',
    sunPos: [-64, 96, -54],
    sunColor: '#cfe3ff',
    sunIntensity: 1.85,
    hemiSky: '#6089cc',
    hemiGround: '#1e273a',
    hemiIntensity: 0.78,
    exposure: 1.08,
  },
};

const SceneEnvironmentSetup: React.FC<{
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  isSoftwareGl: boolean;
}> = ({ timeOfDay, weather, isSoftwareGl }) => {
  const { gl, scene } = useThree();
  const base = LIGHTING_PRESETS[timeOfDay];

  const isMutedWeather = weather === 'cloudy' || weather === 'rainy' || weather === 'foggy';
  const skyColor =
    weather === 'rainy'
      ? timeOfDay === 'night'
        ? '#050912'
        : '#889aa8'
      : weather === 'cloudy'
        ? timeOfDay === 'night'
          ? '#070c18'
          : '#a8bac8'
        : weather === 'foggy'
          ? timeOfDay === 'night'
            ? '#091020'
            : '#c9d4dc'
          : base.skyColor;

  const fogColor =
    weather === 'sunny'
      ? timeOfDay === 'night'
        ? '#060c1a'
        : base.fogColor
      : skyColor;

  // Automated night fog: rich nocturnal horizon mist at night even when weather === 'sunny'
  const baseFogNear =
    weather === 'foggy'
      ? timeOfDay === 'night'
        ? 36
        : 42
      : weather === 'rainy'
        ? timeOfDay === 'night'
          ? 70
          : 92
        : timeOfDay === 'night'
          ? 96
          : 175;
  const baseFogFar =
    weather === 'foggy'
      ? timeOfDay === 'night'
        ? 185
        : 220
      : weather === 'rainy'
        ? timeOfDay === 'night'
          ? 265
          : 340
        : timeOfDay === 'night'
          ? 340
          : 640;

  const sunMult =
    weather === 'rainy'
      ? timeOfDay === 'night'
        ? 0.68
        : 0.55
      : weather === 'cloudy' || weather === 'foggy'
        ? timeOfDay === 'night'
          ? 0.82
          : 0.72
        : 1.0;

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.52;
    pmrem.dispose();

    return () => {
      scene.environment = null;
      envRT.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(fogColor, baseFogNear, baseFogFar);
    scene.environmentIntensity = timeOfDay === 'night' ? 0.44 : 0.52;
    gl.toneMappingExposure = isMutedWeather ? base.exposure * 0.96 : base.exposure;
  }, [
    scene,
    gl,
    skyColor,
    fogColor,
    baseFogNear,
    baseFogFar,
    isMutedWeather,
    base.exposure,
    timeOfDay,
  ]);

  // Dynamically lift fog horizon when viewing from high Free / Aerial altitudes
  // so the full built city stays bright and clear while distant vast land still fades smoothly.
  useFrame(({ camera }) => {
    const fog = scene.fog;
    if (!(fog instanceof THREE.Fog)) return;
    const altitudeBoost = Math.max(0, camera.position.y - 40) * 2.25;
    fog.near = baseFogNear + altitudeBoost * 0.65;
    fog.far = baseFogFar + altitudeBoost * 2.35;
  });

  return (
    <>
      <SkyAndMoon
        timeOfDay={timeOfDay}
        weather={weather}
        skyHorizonColor={fogColor}
        lightDirection={base.sunPos}
      />
      <hemisphereLight args={[base.hemiSky, base.hemiGround, base.hemiIntensity]} />
      <directionalLight
        position={base.sunPos}
        color={base.sunColor}
        intensity={base.sunIntensity * sunMult}
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={8}
        shadow-camera-far={290}
        shadow-camera-left={-114}
        shadow-camera-right={114}
        shadow-camera-top={114}
        shadow-camera-bottom={-114}
        shadow-bias={-0.00045}
        shadow-normalBias={0.025}
      />
      <directionalLight
        position={[62, 54, 66]}
        color={timeOfDay === 'night' ? '#7aa5e8' : '#d6e6f5'}
        intensity={timeOfDay === 'night' ? 0.62 : 0.45}
      />
    </>
  );
};

const CityWorldContent: React.FC<CitySceneProps & { isSoftwareGl: boolean }> = ({
  plots,
  cameraMode,
  cinematicTour,
  timeOfDay,
  weather,
  selectedPlotId,
  constructionDraft,
  playerProfile,
  sittingBenchId,
  openDoors,
  playerPoseRef,
  mobileInputRef,
  vehicleStatesRef,
  focusTargetRef,
  birdAudioEnabled,
  onSelectPlot,
  onSelectBench,
  onActiveInteractionChange,
  onTriggerPrimaryAction,
  isSoftwareGl,
}) => {
  const { gl } = useThree();

  const textures = useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    return createCityTextureSet(maxAniso);
  }, [gl]);

  useEffect(() => {
    return () => {
      textures.dispose();
    };
  }, [textures]);

  return (
    <>
      <SceneEnvironmentSetup timeOfDay={timeOfDay} weather={weather} isSoftwareGl={isSoftwareGl} />
      <NightStreetLights timeOfDay={timeOfDay} isSoftwareGl={isSoftwareGl} />
      <WindTimeUpdater />
      <CityCameraController
        cameraMode={cameraMode}
        cinematicTour={cinematicTour}
        focusTargetRef={focusTargetRef}
      />
      <WalkingPlayerController
        cameraMode={cameraMode}
        plots={plots}
        playerProfile={playerProfile}
        sittingBenchId={sittingBenchId}
        openDoors={openDoors}
        playerPoseRef={playerPoseRef}
        mobileInputRef={mobileInputRef}
        vehicleStatesRef={vehicleStatesRef}
        focusTargetRef={focusTargetRef}
        onActiveInteractionChange={onActiveInteractionChange}
        onTriggerPrimaryAction={onTriggerPrimaryAction}
      />

      <RoadAndSidewalkSystem textures={textures} timeOfDay={timeOfDay} />
      <CentralPark
        textures={textures}
        activeBenchId={sittingBenchId}
        onSelectBench={onSelectBench}
      />
      <PlotRenderer
        plots={plots}
        textures={textures}
        timeOfDay={timeOfDay}
        selectedPlotId={selectedPlotId}
        constructionDraft={constructionDraft}
        openDoors={openDoors}
        onSelectPlot={(p) => onSelectPlot(p)}
      />
      <TrafficManager timeOfDay={timeOfDay} vehicleStatesRef={vehicleStatesRef} />
      <PedestrianManager />
      <WeatherEffects weather={weather} timeOfDay={timeOfDay} />
      <SpatialBirdAudioController
        plots={plots}
        cameraMode={cameraMode}
        timeOfDay={timeOfDay}
        weather={weather}
        enabled={birdAudioEnabled}
      />
    </>
  );
};

export const CityScene: React.FC<CitySceneProps> = (props) => {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows={!isSoftwareGl ? 'soft' : false}
        dpr={isSoftwareGl ? 1 : [1, 1.75]}
        camera={{ fov: 46, near: 0.3, far: 2200, position: [48, 38, 48] }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onPointerMissed={() => props.onSelectPlot(null)}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            props.onWebGLContextError?.();
          });
        }}
      >
        <CityWorldContent {...props} isSoftwareGl={isSoftwareGl} />
      </Canvas>
    </div>
  );
};
