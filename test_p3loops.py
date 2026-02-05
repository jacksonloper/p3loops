"""
Unit tests for the p3loops module.
"""

import unittest
from p3loops import (
    Side, Point, Edge, 
    is_valid_path, is_noncrossing, is_noncrossing_path,
    edges_cross, make_edge, make_point, parse_side,
    _get_boundary_coordinate
)


class TestPoint(unittest.TestCase):
    """Tests for the Point class."""
    
    def test_point_creation(self):
        """Test creating valid points."""
        p = Point(Side.NORTH, 50)
        self.assertEqual(p.side, Side.NORTH)
        self.assertEqual(p.position, 50)
    
    def test_point_invalid_position(self):
        """Test that invalid positions raise ValueError."""
        with self.assertRaises(ValueError):
            Point(Side.NORTH, -1)
        with self.assertRaises(ValueError):
            Point(Side.NORTH, 101)
    
    def test_point_edge_positions(self):
        """Test edge case positions (0 and 100)."""
        p0 = Point(Side.EAST, 0)
        p100 = Point(Side.EAST, 100)
        self.assertEqual(p0.position, 0)
        self.assertEqual(p100.position, 100)
    
    def test_canonicalize_north(self):
        """Test that North points are canonicalized to East."""
        p = Point(Side.NORTH, 30)
        canonical = p.canonicalize()
        self.assertEqual(canonical.side, Side.EAST)
        self.assertEqual(canonical.position, 30)
    
    def test_canonicalize_south(self):
        """Test that South points are canonicalized to West."""
        p = Point(Side.SOUTH, 70)
        canonical = p.canonicalize()
        self.assertEqual(canonical.side, Side.WEST)
        self.assertEqual(canonical.position, 70)
    
    def test_canonicalize_east_unchanged(self):
        """Test that East points remain unchanged."""
        p = Point(Side.EAST, 45)
        canonical = p.canonicalize()
        self.assertEqual(canonical.side, Side.EAST)
        self.assertEqual(canonical.position, 45)
    
    def test_canonicalize_west_unchanged(self):
        """Test that West points remain unchanged."""
        p = Point(Side.WEST, 55)
        canonical = p.canonicalize()
        self.assertEqual(canonical.side, Side.WEST)
        self.assertEqual(canonical.position, 55)
    
    def test_is_equivalent_north_east(self):
        """Test that North and East points with same position are equivalent."""
        p_north = Point(Side.NORTH, 25)
        p_east = Point(Side.EAST, 25)
        self.assertTrue(p_north.is_equivalent(p_east))
        self.assertTrue(p_east.is_equivalent(p_north))
    
    def test_is_equivalent_south_west(self):
        """Test that South and West points with same position are equivalent."""
        p_south = Point(Side.SOUTH, 75)
        p_west = Point(Side.WEST, 75)
        self.assertTrue(p_south.is_equivalent(p_west))
        self.assertTrue(p_west.is_equivalent(p_south))
    
    def test_not_equivalent_different_positions(self):
        """Test that points with different positions are not equivalent."""
        p1 = Point(Side.NORTH, 30)
        p2 = Point(Side.EAST, 40)
        self.assertFalse(p1.is_equivalent(p2))


class TestEdge(unittest.TestCase):
    """Tests for the Edge class."""
    
    def test_edge_creation(self):
        """Test creating an edge."""
        start = Point(Side.NORTH, 10)
        end = Point(Side.SOUTH, 50)
        edge = Edge(start, end)
        self.assertEqual(edge.start, start)
        self.assertEqual(edge.end, end)
    
    def test_edge_same_side(self):
        """Test creating an edge on the same side."""
        edge = make_edge("north", 10, "north", 40)
        self.assertEqual(edge.start.side, Side.NORTH)
        self.assertEqual(edge.end.side, Side.NORTH)
    
    def test_connects_to_direct(self):
        """Test that edges connect when endpoints match directly."""
        e1 = make_edge("north", 10, "south", 30)
        e2 = make_edge("south", 30, "east", 50)
        self.assertTrue(e1.connects_to(e2))
    
    def test_connects_to_via_identification(self):
        """Test that edges connect via identification (north≡east, south≡west)."""
        # Edge ending at east@30 should connect to edge starting at north@30
        e1 = make_edge("south", 10, "east", 30)
        e2 = make_edge("north", 30, "west", 10)
        self.assertTrue(e1.connects_to(e2))
        
        # Edge ending at west@50 should connect to edge starting at south@50
        e3 = make_edge("north", 20, "west", 50)
        e4 = make_edge("south", 50, "east", 70)
        self.assertTrue(e3.connects_to(e4))
    
    def test_does_not_connect(self):
        """Test that edges with different endpoints don't connect."""
        e1 = make_edge("north", 10, "south", 30)
        e2 = make_edge("south", 40, "east", 50)  # 40 != 30
        self.assertFalse(e1.connects_to(e2))


class TestIsValidPath(unittest.TestCase):
    """Tests for is_valid_path function."""
    
    def test_empty_path(self):
        """Test that an empty list is a valid path."""
        self.assertTrue(is_valid_path([]))
    
    def test_single_edge(self):
        """Test that a single edge is a valid path."""
        edges = [make_edge("north", 10, "south", 50)]
        self.assertTrue(is_valid_path(edges))
    
    def test_valid_chain(self):
        """Test a valid chain of edges."""
        edges = [
            make_edge("north", 10, "south", 30),
            make_edge("south", 30, "east", 50),
            make_edge("east", 50, "west", 70),
        ]
        self.assertTrue(is_valid_path(edges))
    
    def test_valid_chain_with_identification(self):
        """Test a valid chain using identification."""
        edges = [
            make_edge("south", 10, "east", 30),
            make_edge("north", 30, "west", 50),  # north≡east, so connects
            make_edge("south", 50, "east", 70),  # south≡west, so connects
        ]
        self.assertTrue(is_valid_path(edges))
    
    def test_invalid_chain(self):
        """Test an invalid chain where edges don't connect."""
        edges = [
            make_edge("north", 10, "south", 30),
            make_edge("south", 40, "east", 50),  # 40 != 30, doesn't connect
        ]
        self.assertFalse(is_valid_path(edges))


class TestEdgesCross(unittest.TestCase):
    """Tests for edges_cross function."""
    
    def test_crossing_edges(self):
        """Test that crossing edges are detected."""
        # Two edges that clearly cross
        # Note: north@20 ≡ east@20 due to identification, so we need different positions
        e1 = make_edge("north", 10, "south", 10)  # Vertical-ish chord on west side
        e2 = make_edge("east", 50, "west", 50)    # Horizontal-ish chord in middle
        self.assertTrue(edges_cross(e1, e2))
    
    def test_non_crossing_parallel(self):
        """Test that parallel non-crossing edges are not flagged."""
        e1 = make_edge("north", 10, "north", 30)
        e2 = make_edge("north", 50, "north", 70)
        self.assertFalse(edges_cross(e1, e2))
    
    def test_non_crossing_nested(self):
        """Test non-crossing nested edges."""
        # One edge contained within another region
        e1 = make_edge("north", 10, "north", 20)
        e2 = make_edge("south", 60, "south", 70)
        self.assertFalse(edges_cross(e1, e2))
    
    def test_edges_sharing_endpoint(self):
        """Test that edges sharing an endpoint don't cross."""
        e1 = make_edge("north", 10, "south", 50)
        e2 = make_edge("south", 50, "east", 80)
        self.assertFalse(edges_cross(e1, e2))


class TestIsNoncrossing(unittest.TestCase):
    """Tests for is_noncrossing function."""
    
    def test_empty_list(self):
        """Test that an empty list is noncrossing."""
        self.assertTrue(is_noncrossing([]))
    
    def test_single_edge(self):
        """Test that a single edge is noncrossing."""
        edges = [make_edge("north", 10, "south", 50)]
        self.assertTrue(is_noncrossing(edges))
    
    def test_multiple_noncrossing(self):
        """Test multiple non-crossing edges."""
        edges = [
            make_edge("north", 10, "north", 20),
            make_edge("south", 60, "south", 80),
            make_edge("east", 30, "east", 40),
        ]
        self.assertTrue(is_noncrossing(edges))
    
    def test_one_crossing_pair(self):
        """Test that a crossing pair is detected among multiple edges."""
        edges = [
            make_edge("north", 5, "north", 15),   # Non-crossing, small arc on north
            make_edge("north", 10, "south", 10),  # Crosses with next
            make_edge("east", 50, "west", 50),    # Crosses with previous
        ]
        self.assertFalse(is_noncrossing(edges))


class TestIsNoncrossingPath(unittest.TestCase):
    """Tests for is_noncrossing_path function."""
    
    def test_valid_noncrossing_path(self):
        """Test a valid noncrossing path."""
        edges = [
            make_edge("south", 10, "east", 30),
            make_edge("north", 30, "west", 10),
        ]
        self.assertTrue(is_noncrossing_path(edges))
    
    def test_valid_path_but_crossing(self):
        """Test a valid path that has crossing edges."""
        # Create a path that chains but has crossing between non-adjacent edges
        # We need at least 3 edges where edge 1 and edge 3 cross (they don't share endpoints)
        edges = [
            make_edge("north", 10, "south", 10),   # Edge 1: vertical chord on west side
            make_edge("west", 10, "east", 50),     # Edge 2: connects (south@10 ≡ west@10)
            make_edge("east", 50, "west", 50),     # Edge 3: horizontal chord, should cross edge 1
        ]
        # First check it's a valid path
        self.assertTrue(is_valid_path(edges))
        # Edges 1 and 3 should cross
        self.assertTrue(edges_cross(edges[0], edges[2]))
        # Now check the path is crossing
        result = is_noncrossing_path(edges)
        self.assertFalse(result)
    
    def test_invalid_path_noncrossing(self):
        """Test edges that don't form a path but don't cross."""
        edges = [
            make_edge("north", 10, "south", 30),
            make_edge("east", 50, "west", 70),  # Doesn't connect to previous
        ]
        self.assertFalse(is_valid_path(edges))
        self.assertFalse(is_noncrossing_path(edges))


class TestParseAndMake(unittest.TestCase):
    """Tests for parsing and convenience functions."""
    
    def test_parse_side_full_names(self):
        """Test parsing full side names."""
        self.assertEqual(parse_side("north"), Side.NORTH)
        self.assertEqual(parse_side("east"), Side.EAST)
        self.assertEqual(parse_side("south"), Side.SOUTH)
        self.assertEqual(parse_side("west"), Side.WEST)
    
    def test_parse_side_abbreviations(self):
        """Test parsing abbreviated side names."""
        self.assertEqual(parse_side("n"), Side.NORTH)
        self.assertEqual(parse_side("e"), Side.EAST)
        self.assertEqual(parse_side("s"), Side.SOUTH)
        self.assertEqual(parse_side("w"), Side.WEST)
    
    def test_parse_side_case_insensitive(self):
        """Test that parsing is case insensitive."""
        self.assertEqual(parse_side("NORTH"), Side.NORTH)
        self.assertEqual(parse_side("North"), Side.NORTH)
        self.assertEqual(parse_side("N"), Side.NORTH)
    
    def test_parse_side_invalid(self):
        """Test that invalid side names raise ValueError."""
        with self.assertRaises(ValueError):
            parse_side("invalid")
    
    def test_make_point(self):
        """Test make_point convenience function."""
        p = make_point("north", 50)
        self.assertEqual(p.side, Side.NORTH)
        self.assertEqual(p.position, 50)
    
    def test_make_edge(self):
        """Test make_edge convenience function."""
        e = make_edge("n", 10, "s", 90)
        self.assertEqual(e.start.side, Side.NORTH)
        self.assertEqual(e.start.position, 10)
        self.assertEqual(e.end.side, Side.SOUTH)
        self.assertEqual(e.end.position, 90)


class TestBoundaryCoordinate(unittest.TestCase):
    """Tests for _get_boundary_coordinate function."""
    
    def test_north_boundary(self):
        """Test North edge boundary coordinates."""
        # North goes W→E, 0% at west, 100% at east
        p = Point(Side.NORTH, 0)
        self.assertEqual(_get_boundary_coordinate(p), 0)
        
        p = Point(Side.NORTH, 100)
        self.assertEqual(_get_boundary_coordinate(p), 100)
    
    def test_boundary_coordinates_ordering(self):
        """Test that boundary coordinates follow clockwise ordering."""
        # Going clockwise: North(W→E) → East(N→S in boundary terms) → South(E→W) → West(S→N in boundary)
        n_end = _get_boundary_coordinate(Point(Side.NORTH, 100))  # NE corner ~100
        e_start = _get_boundary_coordinate(Point(Side.EAST, 100))  # NE corner (East goes S→N, so 100% is at N)
        
        # These should be at similar positions (NE corner)
        self.assertEqual(n_end, 100)
        self.assertEqual(e_start, 100)


class TestExampleFromProblemStatement(unittest.TestCase):
    """Test the example given in the problem statement."""
    
    def test_example_chain(self):
        """
        Test the example from the problem:
        An edge from 10% through south to 30% through east,
        followed by an edge from 30% through north to 10% through west.
        These should chain because north and east are identified.
        """
        edges = [
            make_edge("south", 10, "east", 30),
            make_edge("north", 30, "west", 10),
        ]
        
        # These should form a valid path
        self.assertTrue(is_valid_path(edges))
        
        # And they should be noncrossing
        self.assertTrue(is_noncrossing_path(edges))


if __name__ == "__main__":
    unittest.main()
