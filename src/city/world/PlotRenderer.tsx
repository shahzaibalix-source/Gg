import React from 'react';
import { CityTextureSet } from '../materials/proceduralTextures';
import { ConstructionDraft, TimeOfDay, TownPlot } from '../types';
import { SIDEWALK_HEIGHT } from './MasterTownBlueprint';
import { HouseModel } from '../assets/HouseModel';
import { CommercialBuilding } from '../assets/CommercialModels';
import { CivicOrEntertainmentBuilding } from '../assets/CivicAndEntertainmentModels';
import { PlotNameplateSign, StylizedTree } from '../assets/FoliageAndProps';
import { ResidentialFence } from '../assets/ResidentialFence';
import { CarMesh } from '../assets/VehicleModels';
import { createBusinessPreset, HOUSE_PRESETS } from '../registry/CityRegistry';
import { isPlotGardenTreeSafe } from './TreePlacementValidator';

interface PlotRendererProps {
  plots: TownPlot[];
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  selectedPlotId: string | null;
  constructionDraft: ConstructionDraft;
  openDoors?: Record<string, boolean>;
  onSelectPlot: (plot: TownPlot) => void;
}

/**
 * Renders every TownPlot across all 6 districts + Central Square:
 * residential homes, luxury villas with pools, commercial storefronts,
 * civic/entertainment complexes, reserved expansion land, and editor ghost previews.
 */
export const PlotRenderer: React.FC<PlotRendererProps> = ({
  plots,
  textures,
  timeOfDay,
  selectedPlotId,
  constructionDraft,
  openDoors = {},
  onSelectPlot,
}) => {
  return (
    <group>
      {plots.map((plot) => {
        const isEmptyTarget =
          !plot.house && !plot.business && !plot.publicBuilding && plot.category !== 'public';
        const isGhostTarget =
          constructionDraft.mode !== 'idle' &&
          constructionDraft.targetPlotId === plot.id &&
          isEmptyTarget;
        const isBuildHighlight = constructionDraft.mode !== 'idle' && isEmptyTarget;
        const isMoveSource =
          constructionDraft.mode === 'move' && constructionDraft.sourcePlotId === plot.id;

        return (
          <SinglePlot
            key={plot.id}
            plot={plot}
            textures={textures}
            timeOfDay={timeOfDay}
            isSelected={selectedPlotId === plot.id}
            isMoveSource={isMoveSource}
            isBuildHighlight={isBuildHighlight}
            showGhostPreview={isGhostTarget}
            constructionDraft={isGhostTarget ? constructionDraft : undefined}
            doorOpen={Boolean(openDoors[plot.id])}
            onSelectPlot={onSelectPlot}
          />
        );
      })}
    </group>
  );
};

interface SinglePlotProps {
  plot: TownPlot;
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  isSelected: boolean;
  isMoveSource: boolean;
  isBuildHighlight: boolean;
  showGhostPreview: boolean;
  constructionDraft?: ConstructionDraft;
  doorOpen: boolean;
  onSelectPlot: (plot: TownPlot) => void;
}

const SinglePlot: React.FC<SinglePlotProps> = React.memo(({
  plot,
  textures,
  timeOfDay,
  isSelected,
  isMoveSource,
  isBuildHighlight,
  showGhostPreview,
  constructionDraft,
  doorOpen,
  onSelectPlot,
}) => {
  const { width, depth, house, business, publicBuilding, gardenTrees, category } = plot;
  const halfW = width / 2;
  const halfD = depth / 2;

  const isResidential =
    category === 'residential' ||
    category === 'luxury-residential' ||
    category === 'expansion-residential';
  const isCommercial = category === 'commercial' || category === 'expansion-commercial';
  const isExpansion =
    category === 'expansion-residential' ||
    category === 'expansion-commercial' ||
    category === 'expansion-public';

  const houseLocalX = house?.hasGarageCarport ? -0.8 : -0.4;
  const houseLocalZ = -1.2;
  const pathX = house ? houseLocalX : 0;
  const pathwayWidth = 2.4;
  const drivewayX = house?.hasGarageCarport
    ? Math.min(halfW - 2.15, houseLocalX + house.width / 2 + 1.45)
    : halfW - 2.65;
  const drivewayWidth = 3.2;
  const drivewayLen = halfD - 1.0;

  const carColors = ['#2b4c6f', '#c93c34', '#d8d5cd', '#395a49', '#3f4754', '#b57b3b'];
  const carStyles = ['sedan', 'hatchback', 'wagon'] as const;
  const carHash = plot.plotCode.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const carZ = house
    ? Math.min(halfD - 2.45, Math.max(houseLocalZ + house.depth / 2 + 2.35, halfD - 3.9))
    : halfD - 3.0;

  // Wider front walkway spanning smoothly from front stoop across the gate onto the public sidewalk
  const pathStartZ = house ? houseLocalZ + house.depth / 2 + 0.45 : 0.6;
  const pathEndZ = halfD + 0.9;
  const pathLen = Math.max(1.8, pathEndZ - pathStartZ);
  const pathCenterZ = (pathStartZ + pathEndZ) / 2;
  const curbStartZ = pathStartZ;
  const curbEndZ = halfD - 0.04;
  const curbLen = Math.max(1.0, curbEndZ - curbStartZ);
  const curbCenterZ = (curbStartZ + curbEndZ) / 2;

  // Courtyard spur connecting main pathway cleanly to the driveway inside the front yard
  const spurStartX = pathX + pathwayWidth / 2;
  const spurEndX = drivewayX - drivewayWidth / 2;
  const spurLen = Math.max(0.4, spurEndX - spurStartX);
  const spurCenterX = (spurStartX + spurEndX) / 2;
  const spurZ = house
    ? Math.min(halfD - 2.35, houseLocalZ + house.depth / 2 + 2.05)
    : 3.2;
  const spurWidth = 1.8;

  const previewRot = ((constructionDraft?.rotationQuarterTurns ?? 0) * Math.PI) / 2;

  const stakeColor =
    category === 'expansion-commercial'
      ? '#3b82f6'
      : category === 'expansion-public'
        ? '#f59e0b'
        : '#4f8c5a';

  return (
    <group
      position={[plot.center.x, 0, plot.center.z]}
      rotation={[0, plot.facingAngle, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectPlot(plot);
      }}
    >
      {/* Plot Base Pad */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[width, SIDEWALK_HEIGHT, depth]} />
        <meshStandardMaterial
          map={isCommercial || publicBuilding ? textures.sidewalkStone : textures.grass}
          color={
            isCommercial
              ? '#cfc8ba'
              : publicBuilding
                ? '#c9c5bb'
                : category === 'luxury-residential'
                  ? '#6ea159'
                  : '#7ea863'
          }
          roughness={0.92}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </mesh>

      {/* Residential / Luxury Driveway, Wider Pathways & Individual Perimeter Fencing */}
      {isResidential && (
        <>
          {/* Cobblestone Driveway + Side Curbs + Full Sidewalk-to-Road Apron */}
          <group position={[drivewayX, SIDEWALK_HEIGHT, 0]}>
            <mesh position={[0, 0.012, halfD - drivewayLen / 2]} receiveShadow>
              <boxGeometry args={[drivewayWidth, 0.024, drivewayLen]} />
              <meshStandardMaterial
                map={textures.cobblestone}
                color="#c8bfb0"
                roughness={0.86}
                polygonOffset
                polygonOffsetFactor={-1}
              />
            </mesh>
            <mesh position={[0, 0.014, halfD + 1.4]} receiveShadow>
              <boxGeometry args={[drivewayWidth, 0.024, 2.8]} />
              <meshStandardMaterial
                map={textures.cobblestone}
                color="#c1b8a8"
                roughness={0.86}
                polygonOffset
                polygonOffsetFactor={-1}
              />
            </mesh>
            {/* Driveway stone border curbs */}
            {[-drivewayWidth / 2 - 0.06, drivewayWidth / 2 + 0.06].map((cx, ci) => (
              <mesh key={`dc-${ci}`} position={[cx, 0.02, (1.0 + halfD - 0.04) / 2]} receiveShadow>
                <boxGeometry args={[0.12, 0.04, Math.max(1.0, halfD - 1.04)]} />
                <meshStandardMaterial color="#b5ada0" roughness={0.85} />
              </mesh>
            ))}
          </group>

          {/* Spacious 2.4m Front Stone Pathway + Side Curbs + Sidewalk Threshold */}
          <mesh position={[pathX, SIDEWALK_HEIGHT + 0.013, pathCenterZ]} receiveShadow>
            <boxGeometry args={[pathwayWidth, 0.024, pathLen]} />
            <meshStandardMaterial
              map={textures.sidewalkStone}
              color="#dfd7c8"
              roughness={0.85}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
          {[-pathwayWidth / 2 - 0.06, pathwayWidth / 2 + 0.06].map((cx, ci) => (
            <mesh
              key={`pc-${ci}`}
              position={[pathX + cx, SIDEWALK_HEIGHT + 0.02, curbCenterZ]}
              receiveShadow
            >
              <boxGeometry args={[0.12, 0.038, curbLen]} />
              <meshStandardMaterial color="#b8b0a2" roughness={0.84} />
            </mesh>
          ))}

          {/* Welcoming Front Porch Landing Pad */}
          {house && (
            <mesh
              position={[pathX, SIDEWALK_HEIGHT + 0.015, houseLocalZ + house.depth / 2 + 0.95]}
              receiveShadow
            >
              <boxGeometry args={[3.0, 0.026, 1.2]} />
              <meshStandardMaterial
                map={textures.sidewalkStone}
                color="#e3dccf"
                roughness={0.84}
                polygonOffset
                polygonOffsetFactor={-2}
              />
            </mesh>
          )}

          {/* Connecting Courtyard Walkway linking Front Pathway to Driveway */}
          {spurLen > 0.3 && (
            <group position={[spurCenterX, SIDEWALK_HEIGHT, spurZ]}>
              <mesh position={[0, 0.013, 0]} receiveShadow>
                <boxGeometry args={[spurLen + 0.08, 0.024, spurWidth]} />
                <meshStandardMaterial
                  map={textures.sidewalkStone}
                  color="#ded6c7"
                  roughness={0.85}
                  polygonOffset
                  polygonOffsetFactor={-1}
                />
              </mesh>
              {[-spurWidth / 2 - 0.05, spurWidth / 2 + 0.05].map((cz, ci) => (
                <mesh key={`sc-${ci}`} position={[0, 0.02, cz]} receiveShadow>
                  <boxGeometry args={[spurLen, 0.036, 0.1]} />
                  <meshStandardMaterial color="#b8b0a2" roughness={0.84} />
                </mesh>
              ))}
            </group>
          )}

          {/* Individual Property Perimeter Fence with Pedestrian Gate & Driveway Opening */}
          <group position={[0, SIDEWALK_HEIGHT, 0]}>
            <ResidentialFence
              plotWidth={width}
              plotDepth={depth}
              archetype={house?.archetype ?? null}
              trimColor={house?.trimColor}
              accentColor={house?.accentColor}
              inset={0.28}
              frontOpenings={[
                { centerX: pathX, width: 2.7, hasGateLeaves: true },
                { centerX: drivewayX, width: 3.5, hasGateLeaves: false },
              ]}
            />
          </group>

          {/* Plot Nameplate Sign positioned cleanly beside Front Gate Pillar */}
          <PlotNameplateSign
            position={[pathX - 2.35, SIDEWALK_HEIGHT, halfD - 0.04]}
            plotCode={plot.plotCode}
            ownerUsername={plot.ownerUsername}
          />

          {/* Parked Car cleanly on Driveway in front of Garage */}
          {house && (
            <group position={[drivewayX, SIDEWALK_HEIGHT + 0.024, carZ]} scale={0.9}>
              <CarMesh
                color={carColors[carHash % carColors.length]}
                style={carStyles[carHash % carStyles.length]}
                timeOfDay={timeOfDay}
              />
            </group>
          )}

          {/* Front Lawn Landscaped Flowerbed Strip */}
          {house && (
            <group position={[Math.max(-halfW + 2.1, pathX - 3.1), SIDEWALK_HEIGHT, halfD - 1.55]}>
              <mesh position={[0, 0.08, 0]} receiveShadow>
                <boxGeometry args={[2.5, 0.16, 0.92]} />
                <meshStandardMaterial color="#4e3727" roughness={0.94} />
              </mesh>
              {[-0.75, 0, 0.75].map((bx, bi) => (
                <group key={`fb-${bi}`} position={[bx, 0.22, 0]}>
                  <mesh castShadow>
                    <dodecahedronGeometry args={[0.26, 0]} />
                    <meshStandardMaterial color={bi === 1 ? '#3b7338' : '#4a8543'} roughness={0.88} />
                  </mesh>
                  <mesh position={[0.08, 0.16, 0.08]}>
                    <sphereGeometry args={[0.09, 6, 6]} />
                    <meshStandardMaterial
                      color={bi === 0 ? '#f43f5e' : bi === 1 ? '#fbbf24' : '#ec4899'}
                      roughness={0.75}
                    />
                  </mesh>
                </group>
              ))}
            </group>
          )}
        </>
      )}

      {/* Luxury Backyard Swimming Pool */}
      {house?.hasPool && (
        <group position={[houseLocalX + 1.5, SIDEWALK_HEIGHT, -halfD + 2.4]}>
          <mesh position={[0, 0.03, 0]} receiveShadow>
            <boxGeometry args={[5.8, 0.06, 3.2]} />
            <meshStandardMaterial color="#dfd7c8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[5.1, 0.04, 2.5]} />
            <meshPhysicalMaterial
              color="#3ea8c9"
              roughness={0.08}
              metalness={0.14}
              clearcoat={0.95}
              envMapIntensity={1.4}
            />
          </mesh>
        </group>
      )}

      {/* Garden Trees (filtered for safe clearance from driveways, walkways, house & pool) */}
      {gardenTrees
        .filter((tree) => isPlotGardenTreeSafe(plot, tree.x, tree.z))
        .map((tree, i) => (
          <StylizedTree
            key={`gt-${i}`}
            position={[tree.x, SIDEWALK_HEIGHT, tree.z]}
            scale={tree.scale}
            variant={tree.variant}
            rotationY={i * 1.4}
          />
        ))}

      {/* Built House, Business, Public Landmark OR Empty Plot Survey Stakes */}
      {house ? (
        <group position={[houseLocalX, SIDEWALK_HEIGHT, houseLocalZ]}>
          <HouseModel
            spec={house}
            textures={textures}
            timeOfDay={timeOfDay}
            doorOpen={doorOpen}
            houseNumber={plot.plotCode}
          />
        </group>
      ) : business ? (
        <group position={[0, SIDEWALK_HEIGHT, -0.6]}>
          <CommercialBuilding
            spec={business}
            textures={textures}
            timeOfDay={timeOfDay}
            doorOpen={doorOpen}
          />
        </group>
      ) : publicBuilding ? (
        <group position={[0, SIDEWALK_HEIGHT, 0]}>
          <CivicOrEntertainmentBuilding
            spec={publicBuilding}
            textures={textures}
            timeOfDay={timeOfDay}
          />
        </group>
      ) : (
        <group position={[0, SIDEWALK_HEIGHT, 0]}>
          {[
            [-4.2, -3.6],
            [4.2, -3.6],
            [-4.2, 3.6],
            [4.2, 3.6],
          ].map(([sx, sz], idx) => (
            <group key={idx} position={[sx, 0, sz]}>
              <mesh position={[0, 0.34, 0]} castShadow>
                <boxGeometry args={[0.1, 0.68, 0.1]} />
                <meshStandardMaterial color="#7b583b" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.62, 0]}>
                <boxGeometry args={[0.16, 0.16, 0.16]} />
                <meshStandardMaterial color={stakeColor} roughness={0.45} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.015, 0]} receiveShadow>
            <boxGeometry args={[8.4, 0.03, 7.2]} />
            <meshStandardMaterial
              map={textures.parkGravel}
              color={isExpansion ? '#d7cfbc' : '#d4cab4'}
              roughness={0.92}
            />
          </mesh>
        </group>
      )}

      {/* Construction Mode Live Footprint Ghost Preview */}
      {showGhostPreview && constructionDraft && (
        <group position={[0, SIDEWALK_HEIGHT, 0]} rotation={[0, previewRot, 0]}>
          {constructionDraft.buildingType === 'house' ? (
            <group>
              <mesh position={[0, 2.8, 0]}>
                <boxGeometry
                  args={[
                    HOUSE_PRESETS[constructionDraft.houseArchetype].width,
                    5.6,
                    HOUSE_PRESETS[constructionDraft.houseArchetype].depth,
                  ]}
                />
                <meshBasicMaterial color="#22c55e" transparent opacity={0.34} wireframe={false} />
              </mesh>
            </group>
          ) : (
            (() => {
              const biz = createBusinessPreset(
                constructionDraft.businessCategory,
                plot.id,
                'Preview',
              );
              return (
                <mesh position={[0, biz.height / 2, 0]}>
                  <boxGeometry args={[biz.width, biz.height, biz.depth]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.34} />
                </mesh>
              );
            })()
          )}
        </group>
      )}

      {/* Selection / Move Source / Valid Target Perimeter Highlight */}
      {(isSelected || isMoveSource || isBuildHighlight) && (
        <group position={[0, SIDEWALK_HEIGHT + 0.055, 0]}>
          {(() => {
            const hlColor = isMoveSource
              ? '#38bdf8'
              : isSelected
                ? '#e5b84b'
                : '#22c55e';
            const op = isSelected || isMoveSource ? 0.92 : 0.45;
            return (
              <>
                <mesh position={[0, 0, halfD - 0.14]}>
                  <boxGeometry args={[width - 0.2, 0.03, 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
                <mesh position={[0, 0, -halfD + 0.14]}>
                  <boxGeometry args={[width - 0.2, 0.03, 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
                <mesh position={[-halfW + 0.14, 0, 0]}>
                  <boxGeometry args={[0.2, 0.03, depth - 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
                <mesh position={[halfW - 0.14, 0, 0]}>
                  <boxGeometry args={[0.2, 0.03, depth - 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
              </>
            );
          })()}
        </group>
      )}
    </group>
  );
});
