"""
P3Loops - A module for working with edges on a square with identified sides.

This module deals with a square where:
- North edge is directed West → East
- East edge is directed South → North
- West edge is directed North → South
- South edge is directed East → West

The North and East edges are identified with each other.
The South and West edges are identified with each other.

An edge is defined by a starting point (side, percentage) and an ending point (side, percentage).
A path is a collection of edges that chain together (endpoint of one = startpoint of next).
A noncrossing path is one where none of the edges cross each other.
"""

from typing import List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class Side(Enum):
    """Represents the four sides of the square."""
    NORTH = "north"
    EAST = "east"
    SOUTH = "south"
    WEST = "west"


@dataclass(frozen=True)
class Point:
    """
    A point on the boundary of the square.
    
    Attributes:
        side: The side of the square (NORTH, EAST, SOUTH, or WEST)
        position: A percentage (0-100) along the side in its directed orientation
    """
    side: Side
    position: float
    
    def __post_init__(self):
        if not 0 <= self.position <= 100:
            raise ValueError(f"Position must be between 0 and 100, got {self.position}")
    
    def canonicalize(self) -> 'Point':
        """
        Return the canonical form of this point.
        
        Due to identifications:
        - North ≡ East: points on North are canonicalized to East
        - South ≡ West: points on South are canonicalized to West
        
        This allows comparing points that are identified with each other.
        """
        if self.side == Side.NORTH:
            # North is identified with East
            return Point(Side.EAST, self.position)
        elif self.side == Side.SOUTH:
            # South is identified with West
            return Point(Side.WEST, self.position)
        return self
    
    def is_equivalent(self, other: 'Point') -> bool:
        """Check if two points are equivalent (considering identifications)."""
        return self.canonicalize() == other.canonicalize()


@dataclass(frozen=True)
class Edge:
    """
    A directed edge on the boundary of the square.
    
    Attributes:
        start: The starting point of the edge
        end: The ending point of the edge
    """
    start: Point
    end: Point
    
    def connects_to(self, other: 'Edge') -> bool:
        """Check if this edge's endpoint connects to another edge's startpoint."""
        return self.end.is_equivalent(other.start)


def is_valid_path(edges: List[Edge]) -> bool:
    """
    Check if a list of edges forms a valid path.
    
    A valid path requires each edge's endpoint to be equivalent to the next edge's startpoint.
    
    Args:
        edges: A list of Edge objects
        
    Returns:
        True if the edges form a valid path, False otherwise
    """
    if len(edges) == 0:
        return True
    
    for i in range(len(edges) - 1):
        if not edges[i].connects_to(edges[i + 1]):
            return False
    
    return True


def _get_boundary_coordinate(point: Point) -> float:
    """
    Convert a point on the boundary to a single coordinate on a continuous boundary.
    
    We traverse the boundary starting from the NW corner going clockwise:
    - North (0-100): percentage along north edge (W→E direction, but we follow boundary)
    - East (100-200): 100 + percentage along east edge (S→N, but boundary goes N→S so we invert)
    - South (200-300): 200 + (100 - percentage) along south edge (E→W direction matches boundary)
    - West (300-400): 300 + (100 - percentage) along west edge (N→S direction matches boundary)
    
    Wait, let me reconsider. The boundary of the square going clockwise from NW corner:
    - North edge: NW → NE (this matches the W→E direction of North)
    - East edge: NE → SE (this is opposite to the S→N direction of East)
    - South edge: SE → SW (this is opposite to the E→W direction of South)
    - West edge: SW → NW (this is opposite to the N→S direction of West)
    
    For edge crossing detection, we need consistent coordinates.
    """
    if point.side == Side.NORTH:
        # North goes W→E, boundary goes W→E from NW corner
        return point.position
    elif point.side == Side.EAST:
        # East goes S→N (up), boundary goes N→S (down) from NE corner
        # So position 0 (at south end) maps to boundary 200, position 100 (at north end) maps to boundary 100
        return 100 + (100 - point.position)
    elif point.side == Side.SOUTH:
        # South goes E→W (right to left), boundary goes E→W from SE corner
        # position 0 is at east end = boundary 200, position 100 is at west end = boundary 300
        return 200 + point.position
    else:  # WEST
        # West goes N→S (down), boundary goes S→N (up) from SW corner
        # position 0 is at north end = boundary 400 (≡ 0 mod 400), position 100 is at south end = boundary 300
        return 300 + (100 - point.position)


def _segments_intersect(a1: float, a2: float, b1: float, b2: float) -> bool:
    """
    Check if two segments on a circle (0-400 range) intersect.
    
    This checks if the arcs from a1 to a2 and from b1 to b2 properly cross.
    We consider segments as arcs going in a specific direction.
    
    Two arcs cross if one arc's start is inside the other arc and its end is outside,
    or vice versa.
    """
    # Normalize to 0-400 range
    a1 = a1 % 400
    a2 = a2 % 400
    b1 = b1 % 400
    b2 = b2 % 400
    
    def point_in_arc(point: float, arc_start: float, arc_end: float) -> bool:
        """Check if a point is strictly inside an arc (not at endpoints)."""
        point = point % 400
        arc_start = arc_start % 400
        arc_end = arc_end % 400
        
        if arc_start == arc_end:
            return False  # Degenerate arc
        
        if arc_start < arc_end:
            return arc_start < point < arc_end
        else:
            # Arc wraps around
            return point > arc_start or point < arc_end
    
    # Check if endpoints of arc B are on different sides of arc A
    b1_in_a = point_in_arc(b1, a1, a2)
    b2_in_a = point_in_arc(b2, a1, a2)
    
    # Check if endpoints of arc A are on different sides of arc B
    a1_in_b = point_in_arc(a1, b1, b2)
    a2_in_b = point_in_arc(a2, b1, b2)
    
    # Arcs cross if exactly one endpoint of each arc is inside the other arc
    return (b1_in_a != b2_in_a) and (a1_in_b != a2_in_b)


def edges_cross(edge1: Edge, edge2: Edge) -> bool:
    """
    Check if two edges cross each other.
    
    Edges are treated as arcs on the boundary of the square.
    Two edges cross if their arcs properly intersect (not just touch at endpoints).
    
    Args:
        edge1: The first edge
        edge2: The second edge
        
    Returns:
        True if the edges cross, False otherwise
    """
    # Check if edges share any endpoint (considering identifications)
    # Edges that share endpoints don't cross
    if (edge1.start.is_equivalent(edge2.start) or
        edge1.start.is_equivalent(edge2.end) or
        edge1.end.is_equivalent(edge2.start) or
        edge1.end.is_equivalent(edge2.end)):
        return False
    
    # Get boundary coordinates for all points
    a1 = _get_boundary_coordinate(edge1.start)
    a2 = _get_boundary_coordinate(edge1.end)
    b1 = _get_boundary_coordinate(edge2.start)
    b2 = _get_boundary_coordinate(edge2.end)
    
    return _segments_intersect(a1, a2, b1, b2)


def is_noncrossing(edges: List[Edge]) -> bool:
    """
    Check if a list of edges are all noncrossing.
    
    Args:
        edges: A list of Edge objects
        
    Returns:
        True if no two edges cross, False otherwise
    """
    for i in range(len(edges)):
        for j in range(i + 1, len(edges)):
            if edges_cross(edges[i], edges[j]):
                return False
    return True


def is_noncrossing_path(edges: List[Edge]) -> bool:
    """
    Check if a collection of edges forms a noncrossing path.
    
    A noncrossing path is a valid path (edges chain together) where no edges cross.
    
    Args:
        edges: A list of Edge objects
        
    Returns:
        True if the edges form a noncrossing path, False otherwise
    """
    return is_valid_path(edges) and is_noncrossing(edges)


# Convenience functions for creating edges from string representations
def parse_side(s: str) -> Side:
    """Parse a side name string to a Side enum."""
    s = s.lower().strip()
    if s in ('n', 'north'):
        return Side.NORTH
    elif s in ('e', 'east'):
        return Side.EAST
    elif s in ('s', 'south'):
        return Side.SOUTH
    elif s in ('w', 'west'):
        return Side.WEST
    else:
        raise ValueError(f"Unknown side: {s}")


def make_point(side: str, position: float) -> Point:
    """Create a Point from a side string and position."""
    return Point(parse_side(side), position)


def make_edge(start_side: str, start_pos: float, end_side: str, end_pos: float) -> Edge:
    """Create an Edge from side strings and positions."""
    return Edge(make_point(start_side, start_pos), make_point(end_side, end_pos))


if __name__ == "__main__":
    # Example usage
    print("P3Loops - Noncrossing Path Checker")
    print("=" * 40)
    
    # Example 1: A simple valid path
    print("\nExample 1: Valid path that chains together")
    edges1 = [
        make_edge("south", 10, "east", 30),
        make_edge("north", 30, "west", 10),  # north≡east, so this connects
    ]
    print(f"  Edges: south@10 → east@30, north@30 → west@10")
    print(f"  Is valid path: {is_valid_path(edges1)}")
    print(f"  Is noncrossing: {is_noncrossing(edges1)}")
    print(f"  Is noncrossing path: {is_noncrossing_path(edges1)}")
    
    # Example 2: Edges that don't chain together
    print("\nExample 2: Edges that don't form a valid path")
    edges2 = [
        make_edge("south", 10, "east", 30),
        make_edge("north", 50, "west", 10),  # Doesn't connect (50 != 30)
    ]
    print(f"  Edges: south@10 → east@30, north@50 → west@10")
    print(f"  Is valid path: {is_valid_path(edges2)}")
    print(f"  Is noncrossing path: {is_noncrossing_path(edges2)}")
    
    # Example 3: Crossing edges
    print("\nExample 3: Crossing edges")
    edges3 = [
        make_edge("north", 10, "south", 10),  # Vertical chord on west side
        make_edge("east", 50, "west", 50),    # Horizontal chord through middle
    ]
    print(f"  Edges: north@10 → south@10, east@50 → west@50")
    print(f"  Is noncrossing: {is_noncrossing(edges3)}")
    
    # Example 4: Non-crossing edges
    print("\nExample 4: Non-crossing edges")
    edges4 = [
        make_edge("north", 20, "north", 40),
        make_edge("south", 60, "south", 80),
    ]
    print(f"  Edges: north@20 → north@40, south@60 → south@80")
    print(f"  Is noncrossing: {is_noncrossing(edges4)}")
