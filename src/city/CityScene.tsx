import React, { useEffect, useMemo, useRef } from 'react';
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
import { ExpansionCityWorld } from './expansion/ExpansionMasterPlan';
import { ExpansionPlotSpec } from './expansion/types';
import { ExpandedCityRenderer } from './expansion/ExpandedCityRenderer';
import { HouseOwnerLabels } from './ui/HouseOwnerLabels';
import type { MasterCityMap } from './planning/types';

interface CitySceneProps {
  plots: TownPlot[];
  masterPlan?: MasterCityMap | null;
  expansionWorld?: ExpansionCityWorld | null;
  cameraMode: CameraMode;
  cinematicTour: CinematicTourId;
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  selectedPlotId: string | null;
  selectedExpansionPlotId?: string | null;
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
  onSelectExpansionPlot?: (plot: ExpansionPlotSpec | null) => void;
  onOpenMonumentModal?: () => void;
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

const _focusCamDir = new THREE.Vector3();

const SceneEnvironmentSetup: React.FC<{
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  isSoftwareGl: boolean;
  isMobileGpu: boolean;
}> = ({ timeOfDay, weather, isSoftwareGl, isMobileGpu }) => {
  const { gl, scene } = useThree();
  const base = LIGHTING_PRESETS[timeOfDay];
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const shadowTarget = useMemo(() => new THREE.Object3D(), []);
  const lastCamNearRef = useRef(0.35);
  const lastAltRef = useRef(-1);

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
    scene.add(shadowTarget);
    const pmrem = new THREE.PMREMGenerator(gl);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.52;
    pmrem.dispose();

    return () => {
      scene.remove(shadowTarget);
      scene.environment = null;
      envRT.dispose();
    };
  }, [gl, scene, shadowTarget]);

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

  useFrame(({ camera }) => {
    // 1. Adaptive near-plane scaling cuts far/near depth ratio from ~17,000:1 to ~350:1 at altitude,
    // eliminating perspective Z-fighting across elevated views without mobile early-Z penalty.
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetNear = THREE.MathUtils.clamp(camera.position.y * 0.032, 0.35, 14);
      if (Math.abs(targetNear - lastCamNearRef.current) > lastCamNearRef.current * 0.14) {
        lastCamNearRef.current = targetNear;
        camera.near = targetNear;
        camera.far = 4200;
        camera.updateProjectionMatrix();
      }
    }

    // 2. Throttle fog horizon lift when altitude changes materially
    const camY = camera.position.y;
    if (Math.abs(camY - lastAltRef.current) > 1.5) {
      lastAltRef.current = camY;
      const fog = scene.fog;
      if (fog instanceof THREE.Fog) {
        const altitudeBoost = Math.max(0, camY - 40) * 2.25;
        fog.near = baseFogNear + altitudeBoost * 0.65;
        fog.far = baseFogFar + altitudeBoost * 2.35;
      }
    }

    // 3. Track viewport focus with snapped directional shadow frustum so shadows stay crisp across neighborhoods
    const light = keyLightRef.current;
    if (light && !isSoftwareGl) {
      camera.getWorldDirection(_focusCamDir);
      const lookScale =
        Math.abs(_focusCamDir.y) > 0.12
          ? THREE.MathUtils.clamp(camY / -_focusCamDir.y, 4, 140)
          : 40;
      const snap = 16;
      const fx = Math.round((camera.position.x + _focusCamDir.x * lookScale) / snap) * snap;
      const fz = Math.round((camera.position.z + _focusCamDir.z * lookScale) / snap) * snap;
      if (
        Math.abs(shadowTarget.position.x - fx) >= snap ||
        Math.abs(shadowTarget.position.z - fz) >= snap
      ) {
        shadowTarget.position.set(fx, 0, fz);
        shadowTarget.updateMatrixWorld();
        light.position.set(fx + base.sunPos[0], base.sunPos[1], fz + base.sunPos[2]);
        light.target = shadowTarget;
      }
    }
  });

  const shadowMapSize = isMobileGpu ? 1024 : 2048;

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
        ref={keyLightRef}
        position={base.sunPos}
        color={base.sunColor}
        intensity={base.sunIntensity * sunMult}
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={8}
        shadow-camera-far={340}
        shadow-camera-left={-128}
        shadow-camera-right={128}
        shadow-camera-top={128}
        shadow-camera-bottom={-128}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <directionalLight
        position={[62, 54, 66]}
        color={timeOfDay === 'night' ? '#7aa5e8' : '#d6e6f5'}
        intensity={timeOfDay === 'night' ? 0.62 : 0.45}
      />
    </>
  );
};

const CityWorldContent: React.FC<
  CitySceneProps & { isSoftwareGl: boolean; isMobileGpu: boolean }
> = ({
  plots,
  masterPlan,
  expansionWorld,
  cameraMode,
  cinematicTour,
  timeOfDay,
  weather,
  selectedPlotId,
  selectedExpansionPlotId,
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
  onSelectExpansionPlot,
  onOpenMonumentModal,
  onSelectBench,
  onActiveInteractionChange,
  onTriggerPrimaryAction,
  isSoftwareGl,
  isMobileGpu,
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
      <SceneEnvironmentSetup
        timeOfDay={timeOfDay}
        weather={weather}
        isSoftwareGl={isSoftwareGl}
        isMobileGpu={isMobileGpu}
      />
      <NightStreetLights timeOfDay={timeOfDay} isSoftwareGl={isSoftwareGl} masterPlan={masterPlan} />
      <WindTimeUpdater />
      <CityCameraController
        cameraMode={cameraMode}
        cinematicTour={cinematicTour}
        focusTargetRef={focusTargetRef}
      />
      <WalkingPlayerController
        cameraMode={cameraMode}
        plots={plots}
        expansionWorld={expansionWorld}
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

      <RoadAndSidewalkSystem textures={textures} timeOfDay={timeOfDay} masterPlan={masterPlan} />
      <CentralPark
        textures={textures}
        timeOfDay={timeOfDay}
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
      {expansionWorld && (
        <ExpandedCityRenderer
          world={expansionWorld}
          textures={textures}
          timeOfDay={timeOfDay}
          cameraMode={cameraMode}
          playerPoseRef={playerPoseRef}
          selectedExpansionPlotId={selectedExpansionPlotId ?? null}
          openDoors={openDoors}
          onSelectExpansionPlot={(ep) => onSelectExpansionPlot?.(ep)}
          onOpenMonumentModal={() => onOpenMonumentModal?.()}
        />
      )}
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
      <HouseOwnerLabels
        plots={plots}
        expansionWorld={expansionWorld}
        cameraMode={cameraMode}
        playerPoseRef={playerPoseRef}
      />
    </>
  );
};

export const CityScene: React.FC<CitySceneProps> = (props) => {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const isMobileGpu = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );
  }, []);

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows={isSoftwareGl ? false : isMobileGpu ? true : 'soft'}
        dpr={isSoftwareGl ? 1 : isMobileGpu ? [1, 1.25] : [1, 1.6]}
        camera={{ fov: 46, near: 0.4, far: 4200, position: [48, 38, 48] }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onPointerMissed={() => {
          props.onSelectPlot(null);
          props.onSelectExpansionPlot?.(null);
        }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            props.onWebGLContextError?.();
          });
        }}
      >
        <CityWorldContent {...props} isSoftwareGl={isSoftwareGl} isMobileGpu={isMobileGpu} />
      </Canvas>
    </div>
  );
};
