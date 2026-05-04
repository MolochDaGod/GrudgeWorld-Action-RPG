
export default function addSword(scene, sword) {
    let childMeshes = sword.getChildMeshes();

    // To find a specific child by name
    let specificChild = childMeshes.find(mesh => mesh.name === "mesh");
    if (specificChild.material && specificChild.material instanceof BABYLON.PBRMaterial) {
        specificChild.material._albedoColor = new BABYLON.Color3(2.7, 2.7, 2.7);
        specificChild.material.metallic = 1;
        specificChild.material.roughness = 1;
        // specificChild.material.roughness = 0.1; // looked cool, consider displacement maps 
        // console.log(specificChild.material);
    } else {
        console.error("Sword material is not a PBRMaterial or is not assigned");
    }

    // Try Bip001 skeleton first (Toon_RTS race chars), then Mixamo fallback
    let rightHand = findAllMeshesByName(scene.meshes, "R_hand_container")[0]
                 || findAllMeshesByName(scene.meshes, "Bip001 R Hand")[0]
                 || findAllMeshesByName(scene.meshes, "mixamorig:RightHand")[0];
    attachSwordToBone(specificChild, rightHand);
    return specificChild;

}

function findAllMeshesByName(meshes, name) {
    let foundMeshes = [];
    meshes.forEach(mesh => {
        if (mesh.name === name) {
            foundMeshes.push(mesh);
        }
        if (mesh.getChildren) {
            foundMeshes = foundMeshes.concat(findAllMeshesByName(mesh.getChildren(), name));
        }
    });
    return foundMeshes;
}

function attachSwordToBone(sword, rightHand) {
    if (!rightHand) {
        console.warn('[held.js] No right hand bone found — sword not attached');
        return;
    }
    // Bip001 skeleton uses different scale/position than Mixamo
    const isBip = rightHand.name.includes('Bip001') || rightHand.name.includes('R_hand');
    let position = isBip ? new BABYLON.Vector3(0, 0.1, 0.04) : new BABYLON.Vector3(0, 26, 10);
    let scaling  = isBip ? new BABYLON.Vector3(2, 2, 2)       : new BABYLON.Vector3(500, 500, 500);
    let rotation = BABYLON.Quaternion.FromEulerAngles(
        degreesToRadians(0),
        degreesToRadians(100),
        degreesToRadians(180)
    );
    attachToBone(sword, rightHand, position, scaling, rotation);
}


const degreesToRadians = (degrees) => degrees * Math.PI / 180;

function attachToBone(mesh, bone, position, scaling, rotation) {
    if (bone) {
        mesh.parent = bone;
        mesh.position = position; // Adjust position relative to the bone as needed
        mesh.scaling = scaling;
        mesh.rotationQuaternion = rotation;
    } else {
        console.error("Bone not found");
    }
}
