# -*- coding: utf-8 -*-
"""
Created on Thu Apr 18 00:47:45 2013

@author: jsousa
"""

import ctypes
from ctypes import c_char,c_int32,c_uint32,c_int16,c_uint16,c_float,c_byte,c_ubyte, \
                Structure,sizeof

import struct

class myStruct(Structure):
    def __str__(self):
        return struct2dict(self).__str__()
    def __dict__(self):
        return struct2dict(self)

def struct2dict(structInstance):
    result = {}
    for field, _ in structInstance._fields_:
         value = getattr(structInstance, field)
         if hasattr(value, "_length_") and hasattr(value, "_type_"):
             # Probably an array
             value = list(value)
         elif hasattr(value, "_fields_"):
             # Probably another struct
             value = struct2dict(value)
         result[field] = value
    return result
    
class tPoint3f(myStruct):
    _fields_ = [
        ('x',c_float),
        ('y',c_float),
        ('z',c_float),
    ]
    def _aslist(self):
        return [self.x,self.y,self.z]
        
class tPoint2f(myStruct):
    _fields_ = [
        ('u',c_float),
        ('v',c_float),
    ]

class tScnHeader(myStruct):
    _fields_ =[
        ('magic',c_char*4),
        ('version', c_int32),
        ('datalen',c_int32),
        ('n_ents',c_int32),
        ('n_solids',c_int32),
        ('solid0_offset',c_int32),  #should always be 0x98
        ('solid0_length',c_int32),	#lengths of solid[0], ie, worldspawn
        ('solids_offset',c_int32),  #offset to solids[1]
        ('solids_length',c_int32),    #length of all other solids
        ('unk2',c_int32),
        ('ents_offset',c_int32),
        ('unk3',c_int32),
        ('unk4',c_int32),
        ('ents_offset2',c_int32),
        ('ents_size',c_int32),
        ('n_extralmaps',c_int32),
        ('lmaps_offset', c_int32),  #lightmaps start address
        ('n_lights',c_int32),   #number of light enteties
    ]

class tSolidHeader(myStruct):
    _fields_ = [
        ('unk1',c_uint32),
        ('n_verts',c_uint32),
        ('n_uvs',c_uint32),
        ('n_vertidxs',c_uint32),
        ('n_planes',c_uint32),
        ('n_nodes',c_uint32),
        ('n_surfs',c_uint32),
        ('n_cells',c_uint32),
        ('n_names',c_uint32),
        ('length',c_uint32),
    ]

class tSurface(myStruct):
    _fields_ = [
        ('texture', c_char*32),
        ('unk', c_float*2),
        ('flags',c_uint16),
        ('alpha',c_uint16),
        ('lmsize', c_uint16*2),
        ('texsize', c_uint16*2),
        ('vertidxstart',c_uint32),
        ('planeidx',c_uint16),
        ('n_verts',c_uint16),
        ('hasVertexColors',c_uint16),
        ('stuff2',c_char*10)
        ]

#surface flags:
#   1st Byte
#       b0
#       b1
#       b2
#       b3
#       b4 - light backsides (also set when smooth is on)
#       b5 - don't receive shadows
#       b6 - 
#       b7 - 
#       b8 - 

#   2nd Byte
#       b0
#       b1
#       b2
#       b3
#       b4
#       b5
#       b6 - no player clip?
#       b7 - water/mist - no clip?
#       b8 - non shootable
    
class tPlane(myStruct):
    _fields_ = [
        ('a',c_float),
        ('b',c_float),
        ('c',c_float),
        ('d',c_float),
        ]

class tBBox(myStruct):
    _fields_ = [
        ('a',tPoint3f),
        ('b',tPoint3f)
        ]
        
class tRawCell(myStruct):
    _fields_ = [
        ('name', c_char*32),
        ('n_nodesidxs', c_int32),
        ('n_portals', c_int32),
        ('n3',c_uint32), #??
        ('skybox',c_char*32),
        #list of nodesidxs
        #list of portals
        #extra data (probably PVS - 
        #   visible surfaces in cell are definately there but seems to be in 
        #   some sort of tree structure)
        ];
class tPortal(myStruct):
    _fields_ = [
        ('name',c_char*32),
        ('nextcell',c_int16), #cell idx this portal looks into
        ('unk',c_int16),
        ('plane',tPlane),
        ('unk', c_float), #float?
        ('n_verts', c_uint32), #number of verts defining the portal
        ('bb_verts', tPoint3f*2),   #portal bounding box points
    ]

class tNode(myStruct):
    _fields_ = [
        ('plane',c_int16),    # splitting plane index
        ('area',c_byte),      # ?
        ('material',c_ubyte), 
        ('node1', c_int16),   # node in front of plane
        ('node2', c_int16),   # node behind plane
        ('nodep', c_int16),   # parent node
        ('cell', c_int16),    # cell index
        ('specialGeomIdx',  c_int16),   # Index of special geometry (whose name is given in solid.names)
        ('unk2',  c_int16),   # ?
    ]

eMaterialNames = {
    0x00: 'default',
    0x10: 'liquid',
    0x20: 'mud',
    0x30: 'gravel',
    0x40: 'plaster',
    0x50: 'carpet',
    0x60: 'glass',
    0x70: 'wood',
    0x80: 'creakwood',
    0x90: 'brick',
    0xA0: 'sheetmetal',
    0xB0: 'steel'
}

def getMaterialName(mat):
    return eMaterialNames[mat]
    
#enum EScnMaterial
#{
#    ESM_DEFAULT     = 0x00,
#    ESM_LIQUID      = 0x10,
#    ESM_MUD         = 0x20,
#    ESM_GRAVEL      = 0x30,
#    ESM_PLASTER     = 0x40,
#    ESM_CARPET      = 0x50,
#    ESM_GLASS       = 0x60,
#    ESM_WOOD        = 0x70,
#    ESM_CREAKWOOD   = 0x80,
#    ESM_BRICK       = 0x90,
#    ESM_SHEETMETAL  = 0xA0,
#    ESM_STEEL       = 0xB0
#};
    
class tSwitchableLMapHeader(myStruct):
    _fields_ = [
        ('solid',c_uint32),  #index of the solid it belongs to
        ('sidx',c_uint32),   #surface index (relative to solid)
        ('unk',c_uint32),    #usually zero? In missiona its always 17. Maybe cell?
        ('lmsize',c_uint32*2),
        ('offset',c_uint32)  #offset into lmap data
    ]

class tLMapHeader(myStruct):
    _fields_ = [
        ('pos', c_uint16),   #flat index into 128x128 matrix texture 
                                    #where this light bitmap starts
        ('b', c_uint16),
        ('offset', c_uint32),
        ('cellidx', c_uint16),  #i think, check
        ('unk',c_int16), #can be -1
        ('uv_mults',c_float*4)     
        #these are w,h,x0,y0 that we need to multiply by a vertex regular uv 
        #to get the lightmap uv
    ]

class tLMapLump(myStruct):
    _fields_ = [
        ('size',c_uint32),
        ('unk',c_int32),
        ]
        #also contains a field data with type byte[size]


# read helper functions
# --------------------------------------------------------

def read_generic(f,fmt):
    return struct.unpack(fmt,f.read(struct.calcsize(fmt)))

def read_array(f,fmt,n=1):
    a = read_generic(f,'=' + str(int(n))+fmt)
    return a if len(a)> 1 else a[0]

def read_u32(f,n=1):
    return read_array(f,'I',n)

def read_s32(f,n=1):
    return read_array(f,'i',n)

def read_u16(f,n=1):
    return read_array(f,'H',n)
   
def read_f32(f,n=1):
    return read_array(f,'f',n)
        
def read_struct(filelike,structClass):
    return structClass.from_buffer_copy(filelike.read(sizeof(structClass)))

def read_cstring(file,size):
    """
    read size bytes from file and returns string.
    
    If string is null terminated, return only up to null character
    """
    return file.read(size).split('\0',1)[0]
    

def format_bbox(bb):
    return [bb.a._aslist(),bb.b._aslist()]